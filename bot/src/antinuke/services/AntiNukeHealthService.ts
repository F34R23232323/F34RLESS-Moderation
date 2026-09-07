export interface DependencyProbe { ping(): Promise<boolean> }
export interface AntiNukeHealth { database: boolean; redis: boolean; auditLog: boolean; enforcementAllowed: boolean }

export class AntiNukeHealthService {
  public constructor(private readonly database: DependencyProbe, private readonly redis: DependencyProbe | null) {}
  public async check(auditLogAvailable: boolean): Promise<AntiNukeHealth> {
    const [database, redis] = await Promise.all([
      this.database.ping().catch(() => false),
      this.redis ? this.redis.ping().catch(() => false) : Promise.resolve(false),
    ]);
    return { database, redis, auditLog: auditLogAvailable, enforcementAllowed: database && redis && auditLogAvailable };
  }
}
