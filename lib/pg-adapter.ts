/** Postgres behind the statement API the routes already use (prepare/bind/first/all/run/batch). No driver imports: tests plug in PGlite. */
export type Row=Record<string,unknown>;
export type Runner={query(text:string,params:unknown[]):Promise<Row[]>;transaction<T>(fn:(tx:Pick<Runner,'query'>)=>Promise<T>):Promise<T>};
/** `?` → `$n`. SQL in this project never uses `?` inside literals. */
export function placeholders(sql:string){let n=0;return sql.replace(/\?/g,()=>'$'+(++n))}
export class Statement{
 args:unknown[]=[];
 constructor(private runner:Runner,readonly sql:string){}
 bind(...args:unknown[]){this.args=args;return this}
 exec(q:Pick<Runner,'query'>=this.runner){return q.query(placeholders(this.sql),this.args)}
 async first<T=Row>():Promise<T|null>{return ((await this.exec())[0] as T)??null}
 async all<T=Row>():Promise<{results:T[]}>{return {results:await this.exec() as T[]}}
 async run(){await this.exec();return {success:true}}
}
export type Database={prepare(sql:string):Statement;batch(statements:Statement[]):Promise<void>};
/** `batch` runs every statement in one transaction: an import is fully active or not at all. */
export function database(runner:Runner):Database{return {prepare:sql=>new Statement(runner,sql),batch:statements=>runner.transaction(async tx=>{for(const s of statements)await s.exec(tx)})}}
