
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model Quota
 * 
 */
export type Quota = $Result.DefaultSelection<Prisma.$QuotaPayload>
/**
 * Model Storage
 * 
 */
export type Storage = $Result.DefaultSelection<Prisma.$StoragePayload>
/**
 * Model Content
 * 
 */
export type Content = $Result.DefaultSelection<Prisma.$ContentPayload>
/**
 * Model CustomerBots
 * 
 */
export type CustomerBots = $Result.DefaultSelection<Prisma.$CustomerBotsPayload>
/**
 * Model CustomerChats
 * 
 */
export type CustomerChats = $Result.DefaultSelection<Prisma.$CustomerChatsPayload>
/**
 * Model CustomerChatDetails
 * 
 */
export type CustomerChatDetails = $Result.DefaultSelection<Prisma.$CustomerChatDetailsPayload>
/**
 * Model GeoLocation
 * 
 */
export type GeoLocation = $Result.DefaultSelection<Prisma.$GeoLocationPayload>

/**
 * Enums
 */
export namespace $Enums {
  export const QuotaType: {
  BOT: 'BOT',
  FILE: 'FILE',
  TOKEN: 'TOKEN'
};

export type QuotaType = (typeof QuotaType)[keyof typeof QuotaType]

}

export type QuotaType = $Enums.QuotaType

export const QuotaType: typeof $Enums.QuotaType

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Users
   * const users = await prisma.user.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.quota`: Exposes CRUD operations for the **Quota** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Quotas
    * const quotas = await prisma.quota.findMany()
    * ```
    */
  get quota(): Prisma.QuotaDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.storage`: Exposes CRUD operations for the **Storage** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Storages
    * const storages = await prisma.storage.findMany()
    * ```
    */
  get storage(): Prisma.StorageDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.content`: Exposes CRUD operations for the **Content** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Contents
    * const contents = await prisma.content.findMany()
    * ```
    */
  get content(): Prisma.ContentDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.customerBots`: Exposes CRUD operations for the **CustomerBots** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more CustomerBots
    * const customerBots = await prisma.customerBots.findMany()
    * ```
    */
  get customerBots(): Prisma.CustomerBotsDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.customerChats`: Exposes CRUD operations for the **CustomerChats** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more CustomerChats
    * const customerChats = await prisma.customerChats.findMany()
    * ```
    */
  get customerChats(): Prisma.CustomerChatsDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.customerChatDetails`: Exposes CRUD operations for the **CustomerChatDetails** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more CustomerChatDetails
    * const customerChatDetails = await prisma.customerChatDetails.findMany()
    * ```
    */
  get customerChatDetails(): Prisma.CustomerChatDetailsDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.geoLocation`: Exposes CRUD operations for the **GeoLocation** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more GeoLocations
    * const geoLocations = await prisma.geoLocation.findMany()
    * ```
    */
  get geoLocation(): Prisma.GeoLocationDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.6.0
   * Query Engine version: f676762280b54cd07c770017ed3711ddde35f37a
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    User: 'User',
    Quota: 'Quota',
    Storage: 'Storage',
    Content: 'Content',
    CustomerBots: 'CustomerBots',
    CustomerChats: 'CustomerChats',
    CustomerChatDetails: 'CustomerChatDetails',
    GeoLocation: 'GeoLocation'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "user" | "quota" | "storage" | "content" | "customerBots" | "customerChats" | "customerChatDetails" | "geoLocation"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      Quota: {
        payload: Prisma.$QuotaPayload<ExtArgs>
        fields: Prisma.QuotaFieldRefs
        operations: {
          findUnique: {
            args: Prisma.QuotaFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$QuotaPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.QuotaFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$QuotaPayload>
          }
          findFirst: {
            args: Prisma.QuotaFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$QuotaPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.QuotaFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$QuotaPayload>
          }
          findMany: {
            args: Prisma.QuotaFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$QuotaPayload>[]
          }
          create: {
            args: Prisma.QuotaCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$QuotaPayload>
          }
          createMany: {
            args: Prisma.QuotaCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.QuotaCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$QuotaPayload>[]
          }
          delete: {
            args: Prisma.QuotaDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$QuotaPayload>
          }
          update: {
            args: Prisma.QuotaUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$QuotaPayload>
          }
          deleteMany: {
            args: Prisma.QuotaDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.QuotaUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.QuotaUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$QuotaPayload>[]
          }
          upsert: {
            args: Prisma.QuotaUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$QuotaPayload>
          }
          aggregate: {
            args: Prisma.QuotaAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateQuota>
          }
          groupBy: {
            args: Prisma.QuotaGroupByArgs<ExtArgs>
            result: $Utils.Optional<QuotaGroupByOutputType>[]
          }
          count: {
            args: Prisma.QuotaCountArgs<ExtArgs>
            result: $Utils.Optional<QuotaCountAggregateOutputType> | number
          }
        }
      }
      Storage: {
        payload: Prisma.$StoragePayload<ExtArgs>
        fields: Prisma.StorageFieldRefs
        operations: {
          findUnique: {
            args: Prisma.StorageFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StoragePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.StorageFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StoragePayload>
          }
          findFirst: {
            args: Prisma.StorageFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StoragePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.StorageFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StoragePayload>
          }
          findMany: {
            args: Prisma.StorageFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StoragePayload>[]
          }
          create: {
            args: Prisma.StorageCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StoragePayload>
          }
          createMany: {
            args: Prisma.StorageCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.StorageCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StoragePayload>[]
          }
          delete: {
            args: Prisma.StorageDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StoragePayload>
          }
          update: {
            args: Prisma.StorageUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StoragePayload>
          }
          deleteMany: {
            args: Prisma.StorageDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.StorageUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.StorageUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StoragePayload>[]
          }
          upsert: {
            args: Prisma.StorageUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$StoragePayload>
          }
          aggregate: {
            args: Prisma.StorageAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateStorage>
          }
          groupBy: {
            args: Prisma.StorageGroupByArgs<ExtArgs>
            result: $Utils.Optional<StorageGroupByOutputType>[]
          }
          count: {
            args: Prisma.StorageCountArgs<ExtArgs>
            result: $Utils.Optional<StorageCountAggregateOutputType> | number
          }
        }
      }
      Content: {
        payload: Prisma.$ContentPayload<ExtArgs>
        fields: Prisma.ContentFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ContentFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContentPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ContentFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContentPayload>
          }
          findFirst: {
            args: Prisma.ContentFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContentPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ContentFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContentPayload>
          }
          findMany: {
            args: Prisma.ContentFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContentPayload>[]
          }
          create: {
            args: Prisma.ContentCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContentPayload>
          }
          createMany: {
            args: Prisma.ContentCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ContentCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContentPayload>[]
          }
          delete: {
            args: Prisma.ContentDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContentPayload>
          }
          update: {
            args: Prisma.ContentUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContentPayload>
          }
          deleteMany: {
            args: Prisma.ContentDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ContentUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ContentUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContentPayload>[]
          }
          upsert: {
            args: Prisma.ContentUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContentPayload>
          }
          aggregate: {
            args: Prisma.ContentAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateContent>
          }
          groupBy: {
            args: Prisma.ContentGroupByArgs<ExtArgs>
            result: $Utils.Optional<ContentGroupByOutputType>[]
          }
          count: {
            args: Prisma.ContentCountArgs<ExtArgs>
            result: $Utils.Optional<ContentCountAggregateOutputType> | number
          }
        }
      }
      CustomerBots: {
        payload: Prisma.$CustomerBotsPayload<ExtArgs>
        fields: Prisma.CustomerBotsFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CustomerBotsFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerBotsPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CustomerBotsFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerBotsPayload>
          }
          findFirst: {
            args: Prisma.CustomerBotsFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerBotsPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CustomerBotsFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerBotsPayload>
          }
          findMany: {
            args: Prisma.CustomerBotsFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerBotsPayload>[]
          }
          create: {
            args: Prisma.CustomerBotsCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerBotsPayload>
          }
          createMany: {
            args: Prisma.CustomerBotsCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CustomerBotsCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerBotsPayload>[]
          }
          delete: {
            args: Prisma.CustomerBotsDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerBotsPayload>
          }
          update: {
            args: Prisma.CustomerBotsUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerBotsPayload>
          }
          deleteMany: {
            args: Prisma.CustomerBotsDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CustomerBotsUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CustomerBotsUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerBotsPayload>[]
          }
          upsert: {
            args: Prisma.CustomerBotsUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerBotsPayload>
          }
          aggregate: {
            args: Prisma.CustomerBotsAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCustomerBots>
          }
          groupBy: {
            args: Prisma.CustomerBotsGroupByArgs<ExtArgs>
            result: $Utils.Optional<CustomerBotsGroupByOutputType>[]
          }
          count: {
            args: Prisma.CustomerBotsCountArgs<ExtArgs>
            result: $Utils.Optional<CustomerBotsCountAggregateOutputType> | number
          }
        }
      }
      CustomerChats: {
        payload: Prisma.$CustomerChatsPayload<ExtArgs>
        fields: Prisma.CustomerChatsFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CustomerChatsFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatsPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CustomerChatsFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatsPayload>
          }
          findFirst: {
            args: Prisma.CustomerChatsFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatsPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CustomerChatsFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatsPayload>
          }
          findMany: {
            args: Prisma.CustomerChatsFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatsPayload>[]
          }
          create: {
            args: Prisma.CustomerChatsCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatsPayload>
          }
          createMany: {
            args: Prisma.CustomerChatsCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CustomerChatsCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatsPayload>[]
          }
          delete: {
            args: Prisma.CustomerChatsDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatsPayload>
          }
          update: {
            args: Prisma.CustomerChatsUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatsPayload>
          }
          deleteMany: {
            args: Prisma.CustomerChatsDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CustomerChatsUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CustomerChatsUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatsPayload>[]
          }
          upsert: {
            args: Prisma.CustomerChatsUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatsPayload>
          }
          aggregate: {
            args: Prisma.CustomerChatsAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCustomerChats>
          }
          groupBy: {
            args: Prisma.CustomerChatsGroupByArgs<ExtArgs>
            result: $Utils.Optional<CustomerChatsGroupByOutputType>[]
          }
          count: {
            args: Prisma.CustomerChatsCountArgs<ExtArgs>
            result: $Utils.Optional<CustomerChatsCountAggregateOutputType> | number
          }
        }
      }
      CustomerChatDetails: {
        payload: Prisma.$CustomerChatDetailsPayload<ExtArgs>
        fields: Prisma.CustomerChatDetailsFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CustomerChatDetailsFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatDetailsPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CustomerChatDetailsFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatDetailsPayload>
          }
          findFirst: {
            args: Prisma.CustomerChatDetailsFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatDetailsPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CustomerChatDetailsFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatDetailsPayload>
          }
          findMany: {
            args: Prisma.CustomerChatDetailsFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatDetailsPayload>[]
          }
          create: {
            args: Prisma.CustomerChatDetailsCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatDetailsPayload>
          }
          createMany: {
            args: Prisma.CustomerChatDetailsCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CustomerChatDetailsCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatDetailsPayload>[]
          }
          delete: {
            args: Prisma.CustomerChatDetailsDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatDetailsPayload>
          }
          update: {
            args: Prisma.CustomerChatDetailsUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatDetailsPayload>
          }
          deleteMany: {
            args: Prisma.CustomerChatDetailsDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CustomerChatDetailsUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CustomerChatDetailsUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatDetailsPayload>[]
          }
          upsert: {
            args: Prisma.CustomerChatDetailsUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerChatDetailsPayload>
          }
          aggregate: {
            args: Prisma.CustomerChatDetailsAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCustomerChatDetails>
          }
          groupBy: {
            args: Prisma.CustomerChatDetailsGroupByArgs<ExtArgs>
            result: $Utils.Optional<CustomerChatDetailsGroupByOutputType>[]
          }
          count: {
            args: Prisma.CustomerChatDetailsCountArgs<ExtArgs>
            result: $Utils.Optional<CustomerChatDetailsCountAggregateOutputType> | number
          }
        }
      }
      GeoLocation: {
        payload: Prisma.$GeoLocationPayload<ExtArgs>
        fields: Prisma.GeoLocationFieldRefs
        operations: {
          findUnique: {
            args: Prisma.GeoLocationFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GeoLocationPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.GeoLocationFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GeoLocationPayload>
          }
          findFirst: {
            args: Prisma.GeoLocationFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GeoLocationPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.GeoLocationFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GeoLocationPayload>
          }
          findMany: {
            args: Prisma.GeoLocationFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GeoLocationPayload>[]
          }
          create: {
            args: Prisma.GeoLocationCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GeoLocationPayload>
          }
          createMany: {
            args: Prisma.GeoLocationCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.GeoLocationCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GeoLocationPayload>[]
          }
          delete: {
            args: Prisma.GeoLocationDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GeoLocationPayload>
          }
          update: {
            args: Prisma.GeoLocationUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GeoLocationPayload>
          }
          deleteMany: {
            args: Prisma.GeoLocationDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.GeoLocationUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.GeoLocationUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GeoLocationPayload>[]
          }
          upsert: {
            args: Prisma.GeoLocationUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GeoLocationPayload>
          }
          aggregate: {
            args: Prisma.GeoLocationAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateGeoLocation>
          }
          groupBy: {
            args: Prisma.GeoLocationGroupByArgs<ExtArgs>
            result: $Utils.Optional<GeoLocationGroupByOutputType>[]
          }
          count: {
            args: Prisma.GeoLocationCountArgs<ExtArgs>
            result: $Utils.Optional<GeoLocationCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    user?: UserOmit
    quota?: QuotaOmit
    storage?: StorageOmit
    content?: ContentOmit
    customerBots?: CustomerBotsOmit
    customerChats?: CustomerChatsOmit
    customerChatDetails?: CustomerChatDetailsOmit
    geoLocation?: GeoLocationOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    Storage: number
    CustomerBots: number
    Quota: number
    CustomerChats: number
    Content: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    Storage?: boolean | UserCountOutputTypeCountStorageArgs
    CustomerBots?: boolean | UserCountOutputTypeCountCustomerBotsArgs
    Quota?: boolean | UserCountOutputTypeCountQuotaArgs
    CustomerChats?: boolean | UserCountOutputTypeCountCustomerChatsArgs
    Content?: boolean | UserCountOutputTypeCountContentArgs
  }

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountStorageArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: StorageWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountCustomerBotsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CustomerBotsWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountQuotaArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: QuotaWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountCustomerChatsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CustomerChatsWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountContentArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ContentWhereInput
  }


  /**
   * Count Type CustomerChatsCountOutputType
   */

  export type CustomerChatsCountOutputType = {
    CustomerChatDetails: number
    GeoLocation: number
  }

  export type CustomerChatsCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    CustomerChatDetails?: boolean | CustomerChatsCountOutputTypeCountCustomerChatDetailsArgs
    GeoLocation?: boolean | CustomerChatsCountOutputTypeCountGeoLocationArgs
  }

  // Custom InputTypes
  /**
   * CustomerChatsCountOutputType without action
   */
  export type CustomerChatsCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChatsCountOutputType
     */
    select?: CustomerChatsCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * CustomerChatsCountOutputType without action
   */
  export type CustomerChatsCountOutputTypeCountCustomerChatDetailsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CustomerChatDetailsWhereInput
  }

  /**
   * CustomerChatsCountOutputType without action
   */
  export type CustomerChatsCountOutputTypeCountGeoLocationArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: GeoLocationWhereInput
  }


  /**
   * Models
   */

  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserMinAggregateOutputType = {
    id: string | null
    name: string | null
    email: string | null
    phonenumber: string | null
    password: string | null
    refreshToken: string | null
    emailVerified: boolean | null
    phoneVerified: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    name: string | null
    email: string | null
    phonenumber: string | null
    password: string | null
    refreshToken: string | null
    emailVerified: boolean | null
    phoneVerified: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    name: number
    email: number
    phonenumber: number
    password: number
    refreshToken: number
    emailVerified: number
    phoneVerified: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UserMinAggregateInputType = {
    id?: true
    name?: true
    email?: true
    phonenumber?: true
    password?: true
    refreshToken?: true
    emailVerified?: true
    phoneVerified?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    name?: true
    email?: true
    phonenumber?: true
    password?: true
    refreshToken?: true
    emailVerified?: true
    phoneVerified?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    name?: true
    email?: true
    phonenumber?: true
    password?: true
    refreshToken?: true
    emailVerified?: true
    phoneVerified?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: string
    name: string
    email: string
    phonenumber: string | null
    password: string
    refreshToken: string | null
    emailVerified: boolean
    phoneVerified: boolean
    createdAt: Date
    updatedAt: Date
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    email?: boolean
    phonenumber?: boolean
    password?: boolean
    refreshToken?: boolean
    emailVerified?: boolean
    phoneVerified?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    Storage?: boolean | User$StorageArgs<ExtArgs>
    CustomerBots?: boolean | User$CustomerBotsArgs<ExtArgs>
    Quota?: boolean | User$QuotaArgs<ExtArgs>
    CustomerChats?: boolean | User$CustomerChatsArgs<ExtArgs>
    Content?: boolean | User$ContentArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    email?: boolean
    phonenumber?: boolean
    password?: boolean
    refreshToken?: boolean
    emailVerified?: boolean
    phoneVerified?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    email?: boolean
    phonenumber?: boolean
    password?: boolean
    refreshToken?: boolean
    emailVerified?: boolean
    phoneVerified?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    name?: boolean
    email?: boolean
    phonenumber?: boolean
    password?: boolean
    refreshToken?: boolean
    emailVerified?: boolean
    phoneVerified?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "email" | "phonenumber" | "password" | "refreshToken" | "emailVerified" | "phoneVerified" | "createdAt" | "updatedAt", ExtArgs["result"]["user"]>
  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    Storage?: boolean | User$StorageArgs<ExtArgs>
    CustomerBots?: boolean | User$CustomerBotsArgs<ExtArgs>
    Quota?: boolean | User$QuotaArgs<ExtArgs>
    CustomerChats?: boolean | User$CustomerChatsArgs<ExtArgs>
    Content?: boolean | User$ContentArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type UserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      Storage: Prisma.$StoragePayload<ExtArgs>[]
      CustomerBots: Prisma.$CustomerBotsPayload<ExtArgs>[]
      Quota: Prisma.$QuotaPayload<ExtArgs>[]
      CustomerChats: Prisma.$CustomerChatsPayload<ExtArgs>[]
      Content: Prisma.$ContentPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      email: string
      phonenumber: string | null
      password: string
      refreshToken: string | null
      emailVerified: boolean
      phoneVerified: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `id`
     * const userWithIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    Storage<T extends User$StorageArgs<ExtArgs> = {}>(args?: Subset<T, User$StorageArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$StoragePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    CustomerBots<T extends User$CustomerBotsArgs<ExtArgs> = {}>(args?: Subset<T, User$CustomerBotsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomerBotsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    Quota<T extends User$QuotaArgs<ExtArgs> = {}>(args?: Subset<T, User$QuotaArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$QuotaPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    CustomerChats<T extends User$CustomerChatsArgs<ExtArgs> = {}>(args?: Subset<T, User$CustomerChatsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomerChatsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    Content<T extends User$ContentArgs<ExtArgs> = {}>(args?: Subset<T, User$ContentArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ContentPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'String'>
    readonly name: FieldRef<"User", 'String'>
    readonly email: FieldRef<"User", 'String'>
    readonly phonenumber: FieldRef<"User", 'String'>
    readonly password: FieldRef<"User", 'String'>
    readonly refreshToken: FieldRef<"User", 'String'>
    readonly emailVerified: FieldRef<"User", 'Boolean'>
    readonly phoneVerified: FieldRef<"User", 'Boolean'>
    readonly createdAt: FieldRef<"User", 'DateTime'>
    readonly updatedAt: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User updateManyAndReturn
   */
  export type UserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to delete.
     */
    limit?: number
  }

  /**
   * User.Storage
   */
  export type User$StorageArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Storage
     */
    select?: StorageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Storage
     */
    omit?: StorageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StorageInclude<ExtArgs> | null
    where?: StorageWhereInput
    orderBy?: StorageOrderByWithRelationInput | StorageOrderByWithRelationInput[]
    cursor?: StorageWhereUniqueInput
    take?: number
    skip?: number
    distinct?: StorageScalarFieldEnum | StorageScalarFieldEnum[]
  }

  /**
   * User.CustomerBots
   */
  export type User$CustomerBotsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerBots
     */
    select?: CustomerBotsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerBots
     */
    omit?: CustomerBotsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerBotsInclude<ExtArgs> | null
    where?: CustomerBotsWhereInput
    orderBy?: CustomerBotsOrderByWithRelationInput | CustomerBotsOrderByWithRelationInput[]
    cursor?: CustomerBotsWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CustomerBotsScalarFieldEnum | CustomerBotsScalarFieldEnum[]
  }

  /**
   * User.Quota
   */
  export type User$QuotaArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Quota
     */
    select?: QuotaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Quota
     */
    omit?: QuotaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QuotaInclude<ExtArgs> | null
    where?: QuotaWhereInput
    orderBy?: QuotaOrderByWithRelationInput | QuotaOrderByWithRelationInput[]
    cursor?: QuotaWhereUniqueInput
    take?: number
    skip?: number
    distinct?: QuotaScalarFieldEnum | QuotaScalarFieldEnum[]
  }

  /**
   * User.CustomerChats
   */
  export type User$CustomerChatsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChats
     */
    select?: CustomerChatsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChats
     */
    omit?: CustomerChatsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatsInclude<ExtArgs> | null
    where?: CustomerChatsWhereInput
    orderBy?: CustomerChatsOrderByWithRelationInput | CustomerChatsOrderByWithRelationInput[]
    cursor?: CustomerChatsWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CustomerChatsScalarFieldEnum | CustomerChatsScalarFieldEnum[]
  }

  /**
   * User.Content
   */
  export type User$ContentArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Content
     */
    select?: ContentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Content
     */
    omit?: ContentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContentInclude<ExtArgs> | null
    where?: ContentWhereInput
    orderBy?: ContentOrderByWithRelationInput | ContentOrderByWithRelationInput[]
    cursor?: ContentWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ContentScalarFieldEnum | ContentScalarFieldEnum[]
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model Quota
   */

  export type AggregateQuota = {
    _count: QuotaCountAggregateOutputType | null
    _avg: QuotaAvgAggregateOutputType | null
    _sum: QuotaSumAggregateOutputType | null
    _min: QuotaMinAggregateOutputType | null
    _max: QuotaMaxAggregateOutputType | null
  }

  export type QuotaAvgAggregateOutputType = {
    limit: number | null
    used: number | null
  }

  export type QuotaSumAggregateOutputType = {
    limit: number | null
    used: number | null
  }

  export type QuotaMinAggregateOutputType = {
    id: string | null
    userId: string | null
    quotaType: $Enums.QuotaType | null
    limit: number | null
    used: number | null
  }

  export type QuotaMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    quotaType: $Enums.QuotaType | null
    limit: number | null
    used: number | null
  }

  export type QuotaCountAggregateOutputType = {
    id: number
    userId: number
    quotaType: number
    limit: number
    used: number
    _all: number
  }


  export type QuotaAvgAggregateInputType = {
    limit?: true
    used?: true
  }

  export type QuotaSumAggregateInputType = {
    limit?: true
    used?: true
  }

  export type QuotaMinAggregateInputType = {
    id?: true
    userId?: true
    quotaType?: true
    limit?: true
    used?: true
  }

  export type QuotaMaxAggregateInputType = {
    id?: true
    userId?: true
    quotaType?: true
    limit?: true
    used?: true
  }

  export type QuotaCountAggregateInputType = {
    id?: true
    userId?: true
    quotaType?: true
    limit?: true
    used?: true
    _all?: true
  }

  export type QuotaAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Quota to aggregate.
     */
    where?: QuotaWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Quotas to fetch.
     */
    orderBy?: QuotaOrderByWithRelationInput | QuotaOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: QuotaWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Quotas from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Quotas.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Quotas
    **/
    _count?: true | QuotaCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: QuotaAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: QuotaSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: QuotaMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: QuotaMaxAggregateInputType
  }

  export type GetQuotaAggregateType<T extends QuotaAggregateArgs> = {
        [P in keyof T & keyof AggregateQuota]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateQuota[P]>
      : GetScalarType<T[P], AggregateQuota[P]>
  }




  export type QuotaGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: QuotaWhereInput
    orderBy?: QuotaOrderByWithAggregationInput | QuotaOrderByWithAggregationInput[]
    by: QuotaScalarFieldEnum[] | QuotaScalarFieldEnum
    having?: QuotaScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: QuotaCountAggregateInputType | true
    _avg?: QuotaAvgAggregateInputType
    _sum?: QuotaSumAggregateInputType
    _min?: QuotaMinAggregateInputType
    _max?: QuotaMaxAggregateInputType
  }

  export type QuotaGroupByOutputType = {
    id: string
    userId: string
    quotaType: $Enums.QuotaType | null
    limit: number
    used: number
    _count: QuotaCountAggregateOutputType | null
    _avg: QuotaAvgAggregateOutputType | null
    _sum: QuotaSumAggregateOutputType | null
    _min: QuotaMinAggregateOutputType | null
    _max: QuotaMaxAggregateOutputType | null
  }

  type GetQuotaGroupByPayload<T extends QuotaGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<QuotaGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof QuotaGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], QuotaGroupByOutputType[P]>
            : GetScalarType<T[P], QuotaGroupByOutputType[P]>
        }
      >
    >


  export type QuotaSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    quotaType?: boolean
    limit?: boolean
    used?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["quota"]>

  export type QuotaSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    quotaType?: boolean
    limit?: boolean
    used?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["quota"]>

  export type QuotaSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    quotaType?: boolean
    limit?: boolean
    used?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["quota"]>

  export type QuotaSelectScalar = {
    id?: boolean
    userId?: boolean
    quotaType?: boolean
    limit?: boolean
    used?: boolean
  }

  export type QuotaOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "quotaType" | "limit" | "used", ExtArgs["result"]["quota"]>
  export type QuotaInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type QuotaIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type QuotaIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $QuotaPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Quota"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      quotaType: $Enums.QuotaType | null
      limit: number
      used: number
    }, ExtArgs["result"]["quota"]>
    composites: {}
  }

  type QuotaGetPayload<S extends boolean | null | undefined | QuotaDefaultArgs> = $Result.GetResult<Prisma.$QuotaPayload, S>

  type QuotaCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<QuotaFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: QuotaCountAggregateInputType | true
    }

  export interface QuotaDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Quota'], meta: { name: 'Quota' } }
    /**
     * Find zero or one Quota that matches the filter.
     * @param {QuotaFindUniqueArgs} args - Arguments to find a Quota
     * @example
     * // Get one Quota
     * const quota = await prisma.quota.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends QuotaFindUniqueArgs>(args: SelectSubset<T, QuotaFindUniqueArgs<ExtArgs>>): Prisma__QuotaClient<$Result.GetResult<Prisma.$QuotaPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Quota that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {QuotaFindUniqueOrThrowArgs} args - Arguments to find a Quota
     * @example
     * // Get one Quota
     * const quota = await prisma.quota.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends QuotaFindUniqueOrThrowArgs>(args: SelectSubset<T, QuotaFindUniqueOrThrowArgs<ExtArgs>>): Prisma__QuotaClient<$Result.GetResult<Prisma.$QuotaPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Quota that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuotaFindFirstArgs} args - Arguments to find a Quota
     * @example
     * // Get one Quota
     * const quota = await prisma.quota.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends QuotaFindFirstArgs>(args?: SelectSubset<T, QuotaFindFirstArgs<ExtArgs>>): Prisma__QuotaClient<$Result.GetResult<Prisma.$QuotaPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Quota that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuotaFindFirstOrThrowArgs} args - Arguments to find a Quota
     * @example
     * // Get one Quota
     * const quota = await prisma.quota.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends QuotaFindFirstOrThrowArgs>(args?: SelectSubset<T, QuotaFindFirstOrThrowArgs<ExtArgs>>): Prisma__QuotaClient<$Result.GetResult<Prisma.$QuotaPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Quotas that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuotaFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Quotas
     * const quotas = await prisma.quota.findMany()
     * 
     * // Get first 10 Quotas
     * const quotas = await prisma.quota.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const quotaWithIdOnly = await prisma.quota.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends QuotaFindManyArgs>(args?: SelectSubset<T, QuotaFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$QuotaPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Quota.
     * @param {QuotaCreateArgs} args - Arguments to create a Quota.
     * @example
     * // Create one Quota
     * const Quota = await prisma.quota.create({
     *   data: {
     *     // ... data to create a Quota
     *   }
     * })
     * 
     */
    create<T extends QuotaCreateArgs>(args: SelectSubset<T, QuotaCreateArgs<ExtArgs>>): Prisma__QuotaClient<$Result.GetResult<Prisma.$QuotaPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Quotas.
     * @param {QuotaCreateManyArgs} args - Arguments to create many Quotas.
     * @example
     * // Create many Quotas
     * const quota = await prisma.quota.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends QuotaCreateManyArgs>(args?: SelectSubset<T, QuotaCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Quotas and returns the data saved in the database.
     * @param {QuotaCreateManyAndReturnArgs} args - Arguments to create many Quotas.
     * @example
     * // Create many Quotas
     * const quota = await prisma.quota.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Quotas and only return the `id`
     * const quotaWithIdOnly = await prisma.quota.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends QuotaCreateManyAndReturnArgs>(args?: SelectSubset<T, QuotaCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$QuotaPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Quota.
     * @param {QuotaDeleteArgs} args - Arguments to delete one Quota.
     * @example
     * // Delete one Quota
     * const Quota = await prisma.quota.delete({
     *   where: {
     *     // ... filter to delete one Quota
     *   }
     * })
     * 
     */
    delete<T extends QuotaDeleteArgs>(args: SelectSubset<T, QuotaDeleteArgs<ExtArgs>>): Prisma__QuotaClient<$Result.GetResult<Prisma.$QuotaPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Quota.
     * @param {QuotaUpdateArgs} args - Arguments to update one Quota.
     * @example
     * // Update one Quota
     * const quota = await prisma.quota.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends QuotaUpdateArgs>(args: SelectSubset<T, QuotaUpdateArgs<ExtArgs>>): Prisma__QuotaClient<$Result.GetResult<Prisma.$QuotaPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Quotas.
     * @param {QuotaDeleteManyArgs} args - Arguments to filter Quotas to delete.
     * @example
     * // Delete a few Quotas
     * const { count } = await prisma.quota.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends QuotaDeleteManyArgs>(args?: SelectSubset<T, QuotaDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Quotas.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuotaUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Quotas
     * const quota = await prisma.quota.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends QuotaUpdateManyArgs>(args: SelectSubset<T, QuotaUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Quotas and returns the data updated in the database.
     * @param {QuotaUpdateManyAndReturnArgs} args - Arguments to update many Quotas.
     * @example
     * // Update many Quotas
     * const quota = await prisma.quota.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Quotas and only return the `id`
     * const quotaWithIdOnly = await prisma.quota.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends QuotaUpdateManyAndReturnArgs>(args: SelectSubset<T, QuotaUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$QuotaPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Quota.
     * @param {QuotaUpsertArgs} args - Arguments to update or create a Quota.
     * @example
     * // Update or create a Quota
     * const quota = await prisma.quota.upsert({
     *   create: {
     *     // ... data to create a Quota
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Quota we want to update
     *   }
     * })
     */
    upsert<T extends QuotaUpsertArgs>(args: SelectSubset<T, QuotaUpsertArgs<ExtArgs>>): Prisma__QuotaClient<$Result.GetResult<Prisma.$QuotaPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Quotas.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuotaCountArgs} args - Arguments to filter Quotas to count.
     * @example
     * // Count the number of Quotas
     * const count = await prisma.quota.count({
     *   where: {
     *     // ... the filter for the Quotas we want to count
     *   }
     * })
    **/
    count<T extends QuotaCountArgs>(
      args?: Subset<T, QuotaCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], QuotaCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Quota.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuotaAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends QuotaAggregateArgs>(args: Subset<T, QuotaAggregateArgs>): Prisma.PrismaPromise<GetQuotaAggregateType<T>>

    /**
     * Group by Quota.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QuotaGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends QuotaGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: QuotaGroupByArgs['orderBy'] }
        : { orderBy?: QuotaGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, QuotaGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetQuotaGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Quota model
   */
  readonly fields: QuotaFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Quota.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__QuotaClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Quota model
   */
  interface QuotaFieldRefs {
    readonly id: FieldRef<"Quota", 'String'>
    readonly userId: FieldRef<"Quota", 'String'>
    readonly quotaType: FieldRef<"Quota", 'QuotaType'>
    readonly limit: FieldRef<"Quota", 'Int'>
    readonly used: FieldRef<"Quota", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * Quota findUnique
   */
  export type QuotaFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Quota
     */
    select?: QuotaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Quota
     */
    omit?: QuotaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QuotaInclude<ExtArgs> | null
    /**
     * Filter, which Quota to fetch.
     */
    where: QuotaWhereUniqueInput
  }

  /**
   * Quota findUniqueOrThrow
   */
  export type QuotaFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Quota
     */
    select?: QuotaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Quota
     */
    omit?: QuotaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QuotaInclude<ExtArgs> | null
    /**
     * Filter, which Quota to fetch.
     */
    where: QuotaWhereUniqueInput
  }

  /**
   * Quota findFirst
   */
  export type QuotaFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Quota
     */
    select?: QuotaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Quota
     */
    omit?: QuotaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QuotaInclude<ExtArgs> | null
    /**
     * Filter, which Quota to fetch.
     */
    where?: QuotaWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Quotas to fetch.
     */
    orderBy?: QuotaOrderByWithRelationInput | QuotaOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Quotas.
     */
    cursor?: QuotaWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Quotas from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Quotas.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Quotas.
     */
    distinct?: QuotaScalarFieldEnum | QuotaScalarFieldEnum[]
  }

  /**
   * Quota findFirstOrThrow
   */
  export type QuotaFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Quota
     */
    select?: QuotaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Quota
     */
    omit?: QuotaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QuotaInclude<ExtArgs> | null
    /**
     * Filter, which Quota to fetch.
     */
    where?: QuotaWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Quotas to fetch.
     */
    orderBy?: QuotaOrderByWithRelationInput | QuotaOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Quotas.
     */
    cursor?: QuotaWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Quotas from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Quotas.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Quotas.
     */
    distinct?: QuotaScalarFieldEnum | QuotaScalarFieldEnum[]
  }

  /**
   * Quota findMany
   */
  export type QuotaFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Quota
     */
    select?: QuotaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Quota
     */
    omit?: QuotaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QuotaInclude<ExtArgs> | null
    /**
     * Filter, which Quotas to fetch.
     */
    where?: QuotaWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Quotas to fetch.
     */
    orderBy?: QuotaOrderByWithRelationInput | QuotaOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Quotas.
     */
    cursor?: QuotaWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Quotas from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Quotas.
     */
    skip?: number
    distinct?: QuotaScalarFieldEnum | QuotaScalarFieldEnum[]
  }

  /**
   * Quota create
   */
  export type QuotaCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Quota
     */
    select?: QuotaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Quota
     */
    omit?: QuotaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QuotaInclude<ExtArgs> | null
    /**
     * The data needed to create a Quota.
     */
    data: XOR<QuotaCreateInput, QuotaUncheckedCreateInput>
  }

  /**
   * Quota createMany
   */
  export type QuotaCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Quotas.
     */
    data: QuotaCreateManyInput | QuotaCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Quota createManyAndReturn
   */
  export type QuotaCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Quota
     */
    select?: QuotaSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Quota
     */
    omit?: QuotaOmit<ExtArgs> | null
    /**
     * The data used to create many Quotas.
     */
    data: QuotaCreateManyInput | QuotaCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QuotaIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Quota update
   */
  export type QuotaUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Quota
     */
    select?: QuotaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Quota
     */
    omit?: QuotaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QuotaInclude<ExtArgs> | null
    /**
     * The data needed to update a Quota.
     */
    data: XOR<QuotaUpdateInput, QuotaUncheckedUpdateInput>
    /**
     * Choose, which Quota to update.
     */
    where: QuotaWhereUniqueInput
  }

  /**
   * Quota updateMany
   */
  export type QuotaUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Quotas.
     */
    data: XOR<QuotaUpdateManyMutationInput, QuotaUncheckedUpdateManyInput>
    /**
     * Filter which Quotas to update
     */
    where?: QuotaWhereInput
    /**
     * Limit how many Quotas to update.
     */
    limit?: number
  }

  /**
   * Quota updateManyAndReturn
   */
  export type QuotaUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Quota
     */
    select?: QuotaSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Quota
     */
    omit?: QuotaOmit<ExtArgs> | null
    /**
     * The data used to update Quotas.
     */
    data: XOR<QuotaUpdateManyMutationInput, QuotaUncheckedUpdateManyInput>
    /**
     * Filter which Quotas to update
     */
    where?: QuotaWhereInput
    /**
     * Limit how many Quotas to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QuotaIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Quota upsert
   */
  export type QuotaUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Quota
     */
    select?: QuotaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Quota
     */
    omit?: QuotaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QuotaInclude<ExtArgs> | null
    /**
     * The filter to search for the Quota to update in case it exists.
     */
    where: QuotaWhereUniqueInput
    /**
     * In case the Quota found by the `where` argument doesn't exist, create a new Quota with this data.
     */
    create: XOR<QuotaCreateInput, QuotaUncheckedCreateInput>
    /**
     * In case the Quota was found with the provided `where` argument, update it with this data.
     */
    update: XOR<QuotaUpdateInput, QuotaUncheckedUpdateInput>
  }

  /**
   * Quota delete
   */
  export type QuotaDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Quota
     */
    select?: QuotaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Quota
     */
    omit?: QuotaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QuotaInclude<ExtArgs> | null
    /**
     * Filter which Quota to delete.
     */
    where: QuotaWhereUniqueInput
  }

  /**
   * Quota deleteMany
   */
  export type QuotaDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Quotas to delete
     */
    where?: QuotaWhereInput
    /**
     * Limit how many Quotas to delete.
     */
    limit?: number
  }

  /**
   * Quota without action
   */
  export type QuotaDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Quota
     */
    select?: QuotaSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Quota
     */
    omit?: QuotaOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QuotaInclude<ExtArgs> | null
  }


  /**
   * Model Storage
   */

  export type AggregateStorage = {
    _count: StorageCountAggregateOutputType | null
    _min: StorageMinAggregateOutputType | null
    _max: StorageMaxAggregateOutputType | null
  }

  export type StorageMinAggregateOutputType = {
    id: string | null
    userId: string | null
    botId: string | null
    fileName: string | null
    fileUrl: string | null
    type: string | null
    size: string | null
    status: string | null
    taskId: string | null
    createdAt: Date | null
    updatedAt: Date | null
    deletedAt: Date | null
    isDeleted: boolean | null
  }

  export type StorageMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    botId: string | null
    fileName: string | null
    fileUrl: string | null
    type: string | null
    size: string | null
    status: string | null
    taskId: string | null
    createdAt: Date | null
    updatedAt: Date | null
    deletedAt: Date | null
    isDeleted: boolean | null
  }

  export type StorageCountAggregateOutputType = {
    id: number
    userId: number
    botId: number
    fileName: number
    fileUrl: number
    type: number
    size: number
    status: number
    taskId: number
    ingestionInfo: number
    createdAt: number
    updatedAt: number
    deletedAt: number
    isDeleted: number
    _all: number
  }


  export type StorageMinAggregateInputType = {
    id?: true
    userId?: true
    botId?: true
    fileName?: true
    fileUrl?: true
    type?: true
    size?: true
    status?: true
    taskId?: true
    createdAt?: true
    updatedAt?: true
    deletedAt?: true
    isDeleted?: true
  }

  export type StorageMaxAggregateInputType = {
    id?: true
    userId?: true
    botId?: true
    fileName?: true
    fileUrl?: true
    type?: true
    size?: true
    status?: true
    taskId?: true
    createdAt?: true
    updatedAt?: true
    deletedAt?: true
    isDeleted?: true
  }

  export type StorageCountAggregateInputType = {
    id?: true
    userId?: true
    botId?: true
    fileName?: true
    fileUrl?: true
    type?: true
    size?: true
    status?: true
    taskId?: true
    ingestionInfo?: true
    createdAt?: true
    updatedAt?: true
    deletedAt?: true
    isDeleted?: true
    _all?: true
  }

  export type StorageAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Storage to aggregate.
     */
    where?: StorageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Storages to fetch.
     */
    orderBy?: StorageOrderByWithRelationInput | StorageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: StorageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Storages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Storages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Storages
    **/
    _count?: true | StorageCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: StorageMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: StorageMaxAggregateInputType
  }

  export type GetStorageAggregateType<T extends StorageAggregateArgs> = {
        [P in keyof T & keyof AggregateStorage]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateStorage[P]>
      : GetScalarType<T[P], AggregateStorage[P]>
  }




  export type StorageGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: StorageWhereInput
    orderBy?: StorageOrderByWithAggregationInput | StorageOrderByWithAggregationInput[]
    by: StorageScalarFieldEnum[] | StorageScalarFieldEnum
    having?: StorageScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: StorageCountAggregateInputType | true
    _min?: StorageMinAggregateInputType
    _max?: StorageMaxAggregateInputType
  }

  export type StorageGroupByOutputType = {
    id: string
    userId: string
    botId: string
    fileName: string
    fileUrl: string
    type: string
    size: string
    status: string
    taskId: string
    ingestionInfo: JsonValue | null
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
    isDeleted: boolean
    _count: StorageCountAggregateOutputType | null
    _min: StorageMinAggregateOutputType | null
    _max: StorageMaxAggregateOutputType | null
  }

  type GetStorageGroupByPayload<T extends StorageGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<StorageGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof StorageGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], StorageGroupByOutputType[P]>
            : GetScalarType<T[P], StorageGroupByOutputType[P]>
        }
      >
    >


  export type StorageSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    botId?: boolean
    fileName?: boolean
    fileUrl?: boolean
    type?: boolean
    size?: boolean
    status?: boolean
    taskId?: boolean
    ingestionInfo?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
    isDeleted?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["storage"]>

  export type StorageSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    botId?: boolean
    fileName?: boolean
    fileUrl?: boolean
    type?: boolean
    size?: boolean
    status?: boolean
    taskId?: boolean
    ingestionInfo?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
    isDeleted?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["storage"]>

  export type StorageSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    botId?: boolean
    fileName?: boolean
    fileUrl?: boolean
    type?: boolean
    size?: boolean
    status?: boolean
    taskId?: boolean
    ingestionInfo?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
    isDeleted?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["storage"]>

  export type StorageSelectScalar = {
    id?: boolean
    userId?: boolean
    botId?: boolean
    fileName?: boolean
    fileUrl?: boolean
    type?: boolean
    size?: boolean
    status?: boolean
    taskId?: boolean
    ingestionInfo?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
    isDeleted?: boolean
  }

  export type StorageOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "botId" | "fileName" | "fileUrl" | "type" | "size" | "status" | "taskId" | "ingestionInfo" | "createdAt" | "updatedAt" | "deletedAt" | "isDeleted", ExtArgs["result"]["storage"]>
  export type StorageInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type StorageIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type StorageIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $StoragePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Storage"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      botId: string
      fileName: string
      fileUrl: string
      type: string
      size: string
      status: string
      taskId: string
      ingestionInfo: Prisma.JsonValue | null
      createdAt: Date
      updatedAt: Date
      deletedAt: Date | null
      isDeleted: boolean
    }, ExtArgs["result"]["storage"]>
    composites: {}
  }

  type StorageGetPayload<S extends boolean | null | undefined | StorageDefaultArgs> = $Result.GetResult<Prisma.$StoragePayload, S>

  type StorageCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<StorageFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: StorageCountAggregateInputType | true
    }

  export interface StorageDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Storage'], meta: { name: 'Storage' } }
    /**
     * Find zero or one Storage that matches the filter.
     * @param {StorageFindUniqueArgs} args - Arguments to find a Storage
     * @example
     * // Get one Storage
     * const storage = await prisma.storage.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends StorageFindUniqueArgs>(args: SelectSubset<T, StorageFindUniqueArgs<ExtArgs>>): Prisma__StorageClient<$Result.GetResult<Prisma.$StoragePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Storage that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {StorageFindUniqueOrThrowArgs} args - Arguments to find a Storage
     * @example
     * // Get one Storage
     * const storage = await prisma.storage.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends StorageFindUniqueOrThrowArgs>(args: SelectSubset<T, StorageFindUniqueOrThrowArgs<ExtArgs>>): Prisma__StorageClient<$Result.GetResult<Prisma.$StoragePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Storage that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StorageFindFirstArgs} args - Arguments to find a Storage
     * @example
     * // Get one Storage
     * const storage = await prisma.storage.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends StorageFindFirstArgs>(args?: SelectSubset<T, StorageFindFirstArgs<ExtArgs>>): Prisma__StorageClient<$Result.GetResult<Prisma.$StoragePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Storage that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StorageFindFirstOrThrowArgs} args - Arguments to find a Storage
     * @example
     * // Get one Storage
     * const storage = await prisma.storage.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends StorageFindFirstOrThrowArgs>(args?: SelectSubset<T, StorageFindFirstOrThrowArgs<ExtArgs>>): Prisma__StorageClient<$Result.GetResult<Prisma.$StoragePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Storages that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StorageFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Storages
     * const storages = await prisma.storage.findMany()
     * 
     * // Get first 10 Storages
     * const storages = await prisma.storage.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const storageWithIdOnly = await prisma.storage.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends StorageFindManyArgs>(args?: SelectSubset<T, StorageFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$StoragePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Storage.
     * @param {StorageCreateArgs} args - Arguments to create a Storage.
     * @example
     * // Create one Storage
     * const Storage = await prisma.storage.create({
     *   data: {
     *     // ... data to create a Storage
     *   }
     * })
     * 
     */
    create<T extends StorageCreateArgs>(args: SelectSubset<T, StorageCreateArgs<ExtArgs>>): Prisma__StorageClient<$Result.GetResult<Prisma.$StoragePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Storages.
     * @param {StorageCreateManyArgs} args - Arguments to create many Storages.
     * @example
     * // Create many Storages
     * const storage = await prisma.storage.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends StorageCreateManyArgs>(args?: SelectSubset<T, StorageCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Storages and returns the data saved in the database.
     * @param {StorageCreateManyAndReturnArgs} args - Arguments to create many Storages.
     * @example
     * // Create many Storages
     * const storage = await prisma.storage.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Storages and only return the `id`
     * const storageWithIdOnly = await prisma.storage.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends StorageCreateManyAndReturnArgs>(args?: SelectSubset<T, StorageCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$StoragePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Storage.
     * @param {StorageDeleteArgs} args - Arguments to delete one Storage.
     * @example
     * // Delete one Storage
     * const Storage = await prisma.storage.delete({
     *   where: {
     *     // ... filter to delete one Storage
     *   }
     * })
     * 
     */
    delete<T extends StorageDeleteArgs>(args: SelectSubset<T, StorageDeleteArgs<ExtArgs>>): Prisma__StorageClient<$Result.GetResult<Prisma.$StoragePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Storage.
     * @param {StorageUpdateArgs} args - Arguments to update one Storage.
     * @example
     * // Update one Storage
     * const storage = await prisma.storage.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends StorageUpdateArgs>(args: SelectSubset<T, StorageUpdateArgs<ExtArgs>>): Prisma__StorageClient<$Result.GetResult<Prisma.$StoragePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Storages.
     * @param {StorageDeleteManyArgs} args - Arguments to filter Storages to delete.
     * @example
     * // Delete a few Storages
     * const { count } = await prisma.storage.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends StorageDeleteManyArgs>(args?: SelectSubset<T, StorageDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Storages.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StorageUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Storages
     * const storage = await prisma.storage.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends StorageUpdateManyArgs>(args: SelectSubset<T, StorageUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Storages and returns the data updated in the database.
     * @param {StorageUpdateManyAndReturnArgs} args - Arguments to update many Storages.
     * @example
     * // Update many Storages
     * const storage = await prisma.storage.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Storages and only return the `id`
     * const storageWithIdOnly = await prisma.storage.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends StorageUpdateManyAndReturnArgs>(args: SelectSubset<T, StorageUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$StoragePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Storage.
     * @param {StorageUpsertArgs} args - Arguments to update or create a Storage.
     * @example
     * // Update or create a Storage
     * const storage = await prisma.storage.upsert({
     *   create: {
     *     // ... data to create a Storage
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Storage we want to update
     *   }
     * })
     */
    upsert<T extends StorageUpsertArgs>(args: SelectSubset<T, StorageUpsertArgs<ExtArgs>>): Prisma__StorageClient<$Result.GetResult<Prisma.$StoragePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Storages.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StorageCountArgs} args - Arguments to filter Storages to count.
     * @example
     * // Count the number of Storages
     * const count = await prisma.storage.count({
     *   where: {
     *     // ... the filter for the Storages we want to count
     *   }
     * })
    **/
    count<T extends StorageCountArgs>(
      args?: Subset<T, StorageCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], StorageCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Storage.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StorageAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends StorageAggregateArgs>(args: Subset<T, StorageAggregateArgs>): Prisma.PrismaPromise<GetStorageAggregateType<T>>

    /**
     * Group by Storage.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {StorageGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends StorageGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: StorageGroupByArgs['orderBy'] }
        : { orderBy?: StorageGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, StorageGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetStorageGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Storage model
   */
  readonly fields: StorageFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Storage.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__StorageClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Storage model
   */
  interface StorageFieldRefs {
    readonly id: FieldRef<"Storage", 'String'>
    readonly userId: FieldRef<"Storage", 'String'>
    readonly botId: FieldRef<"Storage", 'String'>
    readonly fileName: FieldRef<"Storage", 'String'>
    readonly fileUrl: FieldRef<"Storage", 'String'>
    readonly type: FieldRef<"Storage", 'String'>
    readonly size: FieldRef<"Storage", 'String'>
    readonly status: FieldRef<"Storage", 'String'>
    readonly taskId: FieldRef<"Storage", 'String'>
    readonly ingestionInfo: FieldRef<"Storage", 'Json'>
    readonly createdAt: FieldRef<"Storage", 'DateTime'>
    readonly updatedAt: FieldRef<"Storage", 'DateTime'>
    readonly deletedAt: FieldRef<"Storage", 'DateTime'>
    readonly isDeleted: FieldRef<"Storage", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * Storage findUnique
   */
  export type StorageFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Storage
     */
    select?: StorageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Storage
     */
    omit?: StorageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StorageInclude<ExtArgs> | null
    /**
     * Filter, which Storage to fetch.
     */
    where: StorageWhereUniqueInput
  }

  /**
   * Storage findUniqueOrThrow
   */
  export type StorageFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Storage
     */
    select?: StorageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Storage
     */
    omit?: StorageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StorageInclude<ExtArgs> | null
    /**
     * Filter, which Storage to fetch.
     */
    where: StorageWhereUniqueInput
  }

  /**
   * Storage findFirst
   */
  export type StorageFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Storage
     */
    select?: StorageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Storage
     */
    omit?: StorageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StorageInclude<ExtArgs> | null
    /**
     * Filter, which Storage to fetch.
     */
    where?: StorageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Storages to fetch.
     */
    orderBy?: StorageOrderByWithRelationInput | StorageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Storages.
     */
    cursor?: StorageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Storages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Storages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Storages.
     */
    distinct?: StorageScalarFieldEnum | StorageScalarFieldEnum[]
  }

  /**
   * Storage findFirstOrThrow
   */
  export type StorageFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Storage
     */
    select?: StorageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Storage
     */
    omit?: StorageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StorageInclude<ExtArgs> | null
    /**
     * Filter, which Storage to fetch.
     */
    where?: StorageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Storages to fetch.
     */
    orderBy?: StorageOrderByWithRelationInput | StorageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Storages.
     */
    cursor?: StorageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Storages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Storages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Storages.
     */
    distinct?: StorageScalarFieldEnum | StorageScalarFieldEnum[]
  }

  /**
   * Storage findMany
   */
  export type StorageFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Storage
     */
    select?: StorageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Storage
     */
    omit?: StorageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StorageInclude<ExtArgs> | null
    /**
     * Filter, which Storages to fetch.
     */
    where?: StorageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Storages to fetch.
     */
    orderBy?: StorageOrderByWithRelationInput | StorageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Storages.
     */
    cursor?: StorageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Storages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Storages.
     */
    skip?: number
    distinct?: StorageScalarFieldEnum | StorageScalarFieldEnum[]
  }

  /**
   * Storage create
   */
  export type StorageCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Storage
     */
    select?: StorageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Storage
     */
    omit?: StorageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StorageInclude<ExtArgs> | null
    /**
     * The data needed to create a Storage.
     */
    data: XOR<StorageCreateInput, StorageUncheckedCreateInput>
  }

  /**
   * Storage createMany
   */
  export type StorageCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Storages.
     */
    data: StorageCreateManyInput | StorageCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Storage createManyAndReturn
   */
  export type StorageCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Storage
     */
    select?: StorageSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Storage
     */
    omit?: StorageOmit<ExtArgs> | null
    /**
     * The data used to create many Storages.
     */
    data: StorageCreateManyInput | StorageCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StorageIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Storage update
   */
  export type StorageUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Storage
     */
    select?: StorageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Storage
     */
    omit?: StorageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StorageInclude<ExtArgs> | null
    /**
     * The data needed to update a Storage.
     */
    data: XOR<StorageUpdateInput, StorageUncheckedUpdateInput>
    /**
     * Choose, which Storage to update.
     */
    where: StorageWhereUniqueInput
  }

  /**
   * Storage updateMany
   */
  export type StorageUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Storages.
     */
    data: XOR<StorageUpdateManyMutationInput, StorageUncheckedUpdateManyInput>
    /**
     * Filter which Storages to update
     */
    where?: StorageWhereInput
    /**
     * Limit how many Storages to update.
     */
    limit?: number
  }

  /**
   * Storage updateManyAndReturn
   */
  export type StorageUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Storage
     */
    select?: StorageSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Storage
     */
    omit?: StorageOmit<ExtArgs> | null
    /**
     * The data used to update Storages.
     */
    data: XOR<StorageUpdateManyMutationInput, StorageUncheckedUpdateManyInput>
    /**
     * Filter which Storages to update
     */
    where?: StorageWhereInput
    /**
     * Limit how many Storages to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StorageIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Storage upsert
   */
  export type StorageUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Storage
     */
    select?: StorageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Storage
     */
    omit?: StorageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StorageInclude<ExtArgs> | null
    /**
     * The filter to search for the Storage to update in case it exists.
     */
    where: StorageWhereUniqueInput
    /**
     * In case the Storage found by the `where` argument doesn't exist, create a new Storage with this data.
     */
    create: XOR<StorageCreateInput, StorageUncheckedCreateInput>
    /**
     * In case the Storage was found with the provided `where` argument, update it with this data.
     */
    update: XOR<StorageUpdateInput, StorageUncheckedUpdateInput>
  }

  /**
   * Storage delete
   */
  export type StorageDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Storage
     */
    select?: StorageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Storage
     */
    omit?: StorageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StorageInclude<ExtArgs> | null
    /**
     * Filter which Storage to delete.
     */
    where: StorageWhereUniqueInput
  }

  /**
   * Storage deleteMany
   */
  export type StorageDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Storages to delete
     */
    where?: StorageWhereInput
    /**
     * Limit how many Storages to delete.
     */
    limit?: number
  }

  /**
   * Storage without action
   */
  export type StorageDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Storage
     */
    select?: StorageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Storage
     */
    omit?: StorageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: StorageInclude<ExtArgs> | null
  }


  /**
   * Model Content
   */

  export type AggregateContent = {
    _count: ContentCountAggregateOutputType | null
    _min: ContentMinAggregateOutputType | null
    _max: ContentMaxAggregateOutputType | null
  }

  export type ContentMinAggregateOutputType = {
    id: string | null
    userId: string | null
    botId: string | null
    type: string | null
    status: string | null
    taskId: string | null
    createdAt: Date | null
    updatedAt: Date | null
    deletedAt: Date | null
    isDeleted: boolean | null
  }

  export type ContentMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    botId: string | null
    type: string | null
    status: string | null
    taskId: string | null
    createdAt: Date | null
    updatedAt: Date | null
    deletedAt: Date | null
    isDeleted: boolean | null
  }

  export type ContentCountAggregateOutputType = {
    id: number
    userId: number
    botId: number
    content: number
    type: number
    status: number
    taskId: number
    ingestionInfo: number
    createdAt: number
    updatedAt: number
    deletedAt: number
    isDeleted: number
    _all: number
  }


  export type ContentMinAggregateInputType = {
    id?: true
    userId?: true
    botId?: true
    type?: true
    status?: true
    taskId?: true
    createdAt?: true
    updatedAt?: true
    deletedAt?: true
    isDeleted?: true
  }

  export type ContentMaxAggregateInputType = {
    id?: true
    userId?: true
    botId?: true
    type?: true
    status?: true
    taskId?: true
    createdAt?: true
    updatedAt?: true
    deletedAt?: true
    isDeleted?: true
  }

  export type ContentCountAggregateInputType = {
    id?: true
    userId?: true
    botId?: true
    content?: true
    type?: true
    status?: true
    taskId?: true
    ingestionInfo?: true
    createdAt?: true
    updatedAt?: true
    deletedAt?: true
    isDeleted?: true
    _all?: true
  }

  export type ContentAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Content to aggregate.
     */
    where?: ContentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Contents to fetch.
     */
    orderBy?: ContentOrderByWithRelationInput | ContentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ContentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Contents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Contents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Contents
    **/
    _count?: true | ContentCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ContentMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ContentMaxAggregateInputType
  }

  export type GetContentAggregateType<T extends ContentAggregateArgs> = {
        [P in keyof T & keyof AggregateContent]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateContent[P]>
      : GetScalarType<T[P], AggregateContent[P]>
  }




  export type ContentGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ContentWhereInput
    orderBy?: ContentOrderByWithAggregationInput | ContentOrderByWithAggregationInput[]
    by: ContentScalarFieldEnum[] | ContentScalarFieldEnum
    having?: ContentScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ContentCountAggregateInputType | true
    _min?: ContentMinAggregateInputType
    _max?: ContentMaxAggregateInputType
  }

  export type ContentGroupByOutputType = {
    id: string
    userId: string
    botId: string
    content: JsonValue | null
    type: string
    status: string
    taskId: string
    ingestionInfo: JsonValue | null
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
    isDeleted: boolean
    _count: ContentCountAggregateOutputType | null
    _min: ContentMinAggregateOutputType | null
    _max: ContentMaxAggregateOutputType | null
  }

  type GetContentGroupByPayload<T extends ContentGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ContentGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ContentGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ContentGroupByOutputType[P]>
            : GetScalarType<T[P], ContentGroupByOutputType[P]>
        }
      >
    >


  export type ContentSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    botId?: boolean
    content?: boolean
    type?: boolean
    status?: boolean
    taskId?: boolean
    ingestionInfo?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
    isDeleted?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["content"]>

  export type ContentSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    botId?: boolean
    content?: boolean
    type?: boolean
    status?: boolean
    taskId?: boolean
    ingestionInfo?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
    isDeleted?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["content"]>

  export type ContentSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    botId?: boolean
    content?: boolean
    type?: boolean
    status?: boolean
    taskId?: boolean
    ingestionInfo?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
    isDeleted?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["content"]>

  export type ContentSelectScalar = {
    id?: boolean
    userId?: boolean
    botId?: boolean
    content?: boolean
    type?: boolean
    status?: boolean
    taskId?: boolean
    ingestionInfo?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
    isDeleted?: boolean
  }

  export type ContentOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "botId" | "content" | "type" | "status" | "taskId" | "ingestionInfo" | "createdAt" | "updatedAt" | "deletedAt" | "isDeleted", ExtArgs["result"]["content"]>
  export type ContentInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type ContentIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type ContentIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $ContentPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Content"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      botId: string
      content: Prisma.JsonValue | null
      type: string
      status: string
      taskId: string
      ingestionInfo: Prisma.JsonValue | null
      createdAt: Date
      updatedAt: Date
      deletedAt: Date | null
      isDeleted: boolean
    }, ExtArgs["result"]["content"]>
    composites: {}
  }

  type ContentGetPayload<S extends boolean | null | undefined | ContentDefaultArgs> = $Result.GetResult<Prisma.$ContentPayload, S>

  type ContentCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ContentFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ContentCountAggregateInputType | true
    }

  export interface ContentDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Content'], meta: { name: 'Content' } }
    /**
     * Find zero or one Content that matches the filter.
     * @param {ContentFindUniqueArgs} args - Arguments to find a Content
     * @example
     * // Get one Content
     * const content = await prisma.content.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ContentFindUniqueArgs>(args: SelectSubset<T, ContentFindUniqueArgs<ExtArgs>>): Prisma__ContentClient<$Result.GetResult<Prisma.$ContentPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Content that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ContentFindUniqueOrThrowArgs} args - Arguments to find a Content
     * @example
     * // Get one Content
     * const content = await prisma.content.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ContentFindUniqueOrThrowArgs>(args: SelectSubset<T, ContentFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ContentClient<$Result.GetResult<Prisma.$ContentPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Content that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ContentFindFirstArgs} args - Arguments to find a Content
     * @example
     * // Get one Content
     * const content = await prisma.content.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ContentFindFirstArgs>(args?: SelectSubset<T, ContentFindFirstArgs<ExtArgs>>): Prisma__ContentClient<$Result.GetResult<Prisma.$ContentPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Content that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ContentFindFirstOrThrowArgs} args - Arguments to find a Content
     * @example
     * // Get one Content
     * const content = await prisma.content.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ContentFindFirstOrThrowArgs>(args?: SelectSubset<T, ContentFindFirstOrThrowArgs<ExtArgs>>): Prisma__ContentClient<$Result.GetResult<Prisma.$ContentPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Contents that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ContentFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Contents
     * const contents = await prisma.content.findMany()
     * 
     * // Get first 10 Contents
     * const contents = await prisma.content.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const contentWithIdOnly = await prisma.content.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ContentFindManyArgs>(args?: SelectSubset<T, ContentFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ContentPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Content.
     * @param {ContentCreateArgs} args - Arguments to create a Content.
     * @example
     * // Create one Content
     * const Content = await prisma.content.create({
     *   data: {
     *     // ... data to create a Content
     *   }
     * })
     * 
     */
    create<T extends ContentCreateArgs>(args: SelectSubset<T, ContentCreateArgs<ExtArgs>>): Prisma__ContentClient<$Result.GetResult<Prisma.$ContentPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Contents.
     * @param {ContentCreateManyArgs} args - Arguments to create many Contents.
     * @example
     * // Create many Contents
     * const content = await prisma.content.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ContentCreateManyArgs>(args?: SelectSubset<T, ContentCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Contents and returns the data saved in the database.
     * @param {ContentCreateManyAndReturnArgs} args - Arguments to create many Contents.
     * @example
     * // Create many Contents
     * const content = await prisma.content.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Contents and only return the `id`
     * const contentWithIdOnly = await prisma.content.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ContentCreateManyAndReturnArgs>(args?: SelectSubset<T, ContentCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ContentPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Content.
     * @param {ContentDeleteArgs} args - Arguments to delete one Content.
     * @example
     * // Delete one Content
     * const Content = await prisma.content.delete({
     *   where: {
     *     // ... filter to delete one Content
     *   }
     * })
     * 
     */
    delete<T extends ContentDeleteArgs>(args: SelectSubset<T, ContentDeleteArgs<ExtArgs>>): Prisma__ContentClient<$Result.GetResult<Prisma.$ContentPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Content.
     * @param {ContentUpdateArgs} args - Arguments to update one Content.
     * @example
     * // Update one Content
     * const content = await prisma.content.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ContentUpdateArgs>(args: SelectSubset<T, ContentUpdateArgs<ExtArgs>>): Prisma__ContentClient<$Result.GetResult<Prisma.$ContentPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Contents.
     * @param {ContentDeleteManyArgs} args - Arguments to filter Contents to delete.
     * @example
     * // Delete a few Contents
     * const { count } = await prisma.content.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ContentDeleteManyArgs>(args?: SelectSubset<T, ContentDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Contents.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ContentUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Contents
     * const content = await prisma.content.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ContentUpdateManyArgs>(args: SelectSubset<T, ContentUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Contents and returns the data updated in the database.
     * @param {ContentUpdateManyAndReturnArgs} args - Arguments to update many Contents.
     * @example
     * // Update many Contents
     * const content = await prisma.content.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Contents and only return the `id`
     * const contentWithIdOnly = await prisma.content.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ContentUpdateManyAndReturnArgs>(args: SelectSubset<T, ContentUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ContentPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Content.
     * @param {ContentUpsertArgs} args - Arguments to update or create a Content.
     * @example
     * // Update or create a Content
     * const content = await prisma.content.upsert({
     *   create: {
     *     // ... data to create a Content
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Content we want to update
     *   }
     * })
     */
    upsert<T extends ContentUpsertArgs>(args: SelectSubset<T, ContentUpsertArgs<ExtArgs>>): Prisma__ContentClient<$Result.GetResult<Prisma.$ContentPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Contents.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ContentCountArgs} args - Arguments to filter Contents to count.
     * @example
     * // Count the number of Contents
     * const count = await prisma.content.count({
     *   where: {
     *     // ... the filter for the Contents we want to count
     *   }
     * })
    **/
    count<T extends ContentCountArgs>(
      args?: Subset<T, ContentCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ContentCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Content.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ContentAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ContentAggregateArgs>(args: Subset<T, ContentAggregateArgs>): Prisma.PrismaPromise<GetContentAggregateType<T>>

    /**
     * Group by Content.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ContentGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ContentGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ContentGroupByArgs['orderBy'] }
        : { orderBy?: ContentGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ContentGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetContentGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Content model
   */
  readonly fields: ContentFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Content.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ContentClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Content model
   */
  interface ContentFieldRefs {
    readonly id: FieldRef<"Content", 'String'>
    readonly userId: FieldRef<"Content", 'String'>
    readonly botId: FieldRef<"Content", 'String'>
    readonly content: FieldRef<"Content", 'Json'>
    readonly type: FieldRef<"Content", 'String'>
    readonly status: FieldRef<"Content", 'String'>
    readonly taskId: FieldRef<"Content", 'String'>
    readonly ingestionInfo: FieldRef<"Content", 'Json'>
    readonly createdAt: FieldRef<"Content", 'DateTime'>
    readonly updatedAt: FieldRef<"Content", 'DateTime'>
    readonly deletedAt: FieldRef<"Content", 'DateTime'>
    readonly isDeleted: FieldRef<"Content", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * Content findUnique
   */
  export type ContentFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Content
     */
    select?: ContentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Content
     */
    omit?: ContentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContentInclude<ExtArgs> | null
    /**
     * Filter, which Content to fetch.
     */
    where: ContentWhereUniqueInput
  }

  /**
   * Content findUniqueOrThrow
   */
  export type ContentFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Content
     */
    select?: ContentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Content
     */
    omit?: ContentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContentInclude<ExtArgs> | null
    /**
     * Filter, which Content to fetch.
     */
    where: ContentWhereUniqueInput
  }

  /**
   * Content findFirst
   */
  export type ContentFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Content
     */
    select?: ContentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Content
     */
    omit?: ContentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContentInclude<ExtArgs> | null
    /**
     * Filter, which Content to fetch.
     */
    where?: ContentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Contents to fetch.
     */
    orderBy?: ContentOrderByWithRelationInput | ContentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Contents.
     */
    cursor?: ContentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Contents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Contents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Contents.
     */
    distinct?: ContentScalarFieldEnum | ContentScalarFieldEnum[]
  }

  /**
   * Content findFirstOrThrow
   */
  export type ContentFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Content
     */
    select?: ContentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Content
     */
    omit?: ContentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContentInclude<ExtArgs> | null
    /**
     * Filter, which Content to fetch.
     */
    where?: ContentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Contents to fetch.
     */
    orderBy?: ContentOrderByWithRelationInput | ContentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Contents.
     */
    cursor?: ContentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Contents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Contents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Contents.
     */
    distinct?: ContentScalarFieldEnum | ContentScalarFieldEnum[]
  }

  /**
   * Content findMany
   */
  export type ContentFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Content
     */
    select?: ContentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Content
     */
    omit?: ContentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContentInclude<ExtArgs> | null
    /**
     * Filter, which Contents to fetch.
     */
    where?: ContentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Contents to fetch.
     */
    orderBy?: ContentOrderByWithRelationInput | ContentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Contents.
     */
    cursor?: ContentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Contents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Contents.
     */
    skip?: number
    distinct?: ContentScalarFieldEnum | ContentScalarFieldEnum[]
  }

  /**
   * Content create
   */
  export type ContentCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Content
     */
    select?: ContentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Content
     */
    omit?: ContentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContentInclude<ExtArgs> | null
    /**
     * The data needed to create a Content.
     */
    data: XOR<ContentCreateInput, ContentUncheckedCreateInput>
  }

  /**
   * Content createMany
   */
  export type ContentCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Contents.
     */
    data: ContentCreateManyInput | ContentCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Content createManyAndReturn
   */
  export type ContentCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Content
     */
    select?: ContentSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Content
     */
    omit?: ContentOmit<ExtArgs> | null
    /**
     * The data used to create many Contents.
     */
    data: ContentCreateManyInput | ContentCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContentIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Content update
   */
  export type ContentUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Content
     */
    select?: ContentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Content
     */
    omit?: ContentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContentInclude<ExtArgs> | null
    /**
     * The data needed to update a Content.
     */
    data: XOR<ContentUpdateInput, ContentUncheckedUpdateInput>
    /**
     * Choose, which Content to update.
     */
    where: ContentWhereUniqueInput
  }

  /**
   * Content updateMany
   */
  export type ContentUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Contents.
     */
    data: XOR<ContentUpdateManyMutationInput, ContentUncheckedUpdateManyInput>
    /**
     * Filter which Contents to update
     */
    where?: ContentWhereInput
    /**
     * Limit how many Contents to update.
     */
    limit?: number
  }

  /**
   * Content updateManyAndReturn
   */
  export type ContentUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Content
     */
    select?: ContentSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Content
     */
    omit?: ContentOmit<ExtArgs> | null
    /**
     * The data used to update Contents.
     */
    data: XOR<ContentUpdateManyMutationInput, ContentUncheckedUpdateManyInput>
    /**
     * Filter which Contents to update
     */
    where?: ContentWhereInput
    /**
     * Limit how many Contents to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContentIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Content upsert
   */
  export type ContentUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Content
     */
    select?: ContentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Content
     */
    omit?: ContentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContentInclude<ExtArgs> | null
    /**
     * The filter to search for the Content to update in case it exists.
     */
    where: ContentWhereUniqueInput
    /**
     * In case the Content found by the `where` argument doesn't exist, create a new Content with this data.
     */
    create: XOR<ContentCreateInput, ContentUncheckedCreateInput>
    /**
     * In case the Content was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ContentUpdateInput, ContentUncheckedUpdateInput>
  }

  /**
   * Content delete
   */
  export type ContentDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Content
     */
    select?: ContentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Content
     */
    omit?: ContentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContentInclude<ExtArgs> | null
    /**
     * Filter which Content to delete.
     */
    where: ContentWhereUniqueInput
  }

  /**
   * Content deleteMany
   */
  export type ContentDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Contents to delete
     */
    where?: ContentWhereInput
    /**
     * Limit how many Contents to delete.
     */
    limit?: number
  }

  /**
   * Content without action
   */
  export type ContentDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Content
     */
    select?: ContentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Content
     */
    omit?: ContentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContentInclude<ExtArgs> | null
  }


  /**
   * Model CustomerBots
   */

  export type AggregateCustomerBots = {
    _count: CustomerBotsCountAggregateOutputType | null
    _min: CustomerBotsMinAggregateOutputType | null
    _max: CustomerBotsMaxAggregateOutputType | null
  }

  export type CustomerBotsMinAggregateOutputType = {
    id: string | null
    userId: string | null
    botName: string | null
    botAvatar: string | null
    systemPrompt: string | null
    active: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
    isDeleted: boolean | null
    deletedAt: Date | null
  }

  export type CustomerBotsMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    botName: string | null
    botAvatar: string | null
    systemPrompt: string | null
    active: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
    isDeleted: boolean | null
    deletedAt: Date | null
  }

  export type CustomerBotsCountAggregateOutputType = {
    id: number
    userId: number
    botName: number
    botAvatar: number
    systemPrompt: number
    settings: number
    active: number
    createdAt: number
    updatedAt: number
    isDeleted: number
    deletedAt: number
    _all: number
  }


  export type CustomerBotsMinAggregateInputType = {
    id?: true
    userId?: true
    botName?: true
    botAvatar?: true
    systemPrompt?: true
    active?: true
    createdAt?: true
    updatedAt?: true
    isDeleted?: true
    deletedAt?: true
  }

  export type CustomerBotsMaxAggregateInputType = {
    id?: true
    userId?: true
    botName?: true
    botAvatar?: true
    systemPrompt?: true
    active?: true
    createdAt?: true
    updatedAt?: true
    isDeleted?: true
    deletedAt?: true
  }

  export type CustomerBotsCountAggregateInputType = {
    id?: true
    userId?: true
    botName?: true
    botAvatar?: true
    systemPrompt?: true
    settings?: true
    active?: true
    createdAt?: true
    updatedAt?: true
    isDeleted?: true
    deletedAt?: true
    _all?: true
  }

  export type CustomerBotsAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CustomerBots to aggregate.
     */
    where?: CustomerBotsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomerBots to fetch.
     */
    orderBy?: CustomerBotsOrderByWithRelationInput | CustomerBotsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CustomerBotsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomerBots from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomerBots.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned CustomerBots
    **/
    _count?: true | CustomerBotsCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CustomerBotsMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CustomerBotsMaxAggregateInputType
  }

  export type GetCustomerBotsAggregateType<T extends CustomerBotsAggregateArgs> = {
        [P in keyof T & keyof AggregateCustomerBots]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCustomerBots[P]>
      : GetScalarType<T[P], AggregateCustomerBots[P]>
  }




  export type CustomerBotsGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CustomerBotsWhereInput
    orderBy?: CustomerBotsOrderByWithAggregationInput | CustomerBotsOrderByWithAggregationInput[]
    by: CustomerBotsScalarFieldEnum[] | CustomerBotsScalarFieldEnum
    having?: CustomerBotsScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CustomerBotsCountAggregateInputType | true
    _min?: CustomerBotsMinAggregateInputType
    _max?: CustomerBotsMaxAggregateInputType
  }

  export type CustomerBotsGroupByOutputType = {
    id: string
    userId: string
    botName: string
    botAvatar: string
    systemPrompt: string
    settings: JsonValue | null
    active: boolean
    createdAt: Date
    updatedAt: Date
    isDeleted: boolean
    deletedAt: Date | null
    _count: CustomerBotsCountAggregateOutputType | null
    _min: CustomerBotsMinAggregateOutputType | null
    _max: CustomerBotsMaxAggregateOutputType | null
  }

  type GetCustomerBotsGroupByPayload<T extends CustomerBotsGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CustomerBotsGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CustomerBotsGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CustomerBotsGroupByOutputType[P]>
            : GetScalarType<T[P], CustomerBotsGroupByOutputType[P]>
        }
      >
    >


  export type CustomerBotsSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    botName?: boolean
    botAvatar?: boolean
    systemPrompt?: boolean
    settings?: boolean
    active?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    isDeleted?: boolean
    deletedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["customerBots"]>

  export type CustomerBotsSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    botName?: boolean
    botAvatar?: boolean
    systemPrompt?: boolean
    settings?: boolean
    active?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    isDeleted?: boolean
    deletedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["customerBots"]>

  export type CustomerBotsSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    botName?: boolean
    botAvatar?: boolean
    systemPrompt?: boolean
    settings?: boolean
    active?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    isDeleted?: boolean
    deletedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["customerBots"]>

  export type CustomerBotsSelectScalar = {
    id?: boolean
    userId?: boolean
    botName?: boolean
    botAvatar?: boolean
    systemPrompt?: boolean
    settings?: boolean
    active?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    isDeleted?: boolean
    deletedAt?: boolean
  }

  export type CustomerBotsOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "botName" | "botAvatar" | "systemPrompt" | "settings" | "active" | "createdAt" | "updatedAt" | "isDeleted" | "deletedAt", ExtArgs["result"]["customerBots"]>
  export type CustomerBotsInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type CustomerBotsIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type CustomerBotsIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $CustomerBotsPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "CustomerBots"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      botName: string
      botAvatar: string
      systemPrompt: string
      settings: Prisma.JsonValue | null
      active: boolean
      createdAt: Date
      updatedAt: Date
      isDeleted: boolean
      deletedAt: Date | null
    }, ExtArgs["result"]["customerBots"]>
    composites: {}
  }

  type CustomerBotsGetPayload<S extends boolean | null | undefined | CustomerBotsDefaultArgs> = $Result.GetResult<Prisma.$CustomerBotsPayload, S>

  type CustomerBotsCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CustomerBotsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CustomerBotsCountAggregateInputType | true
    }

  export interface CustomerBotsDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['CustomerBots'], meta: { name: 'CustomerBots' } }
    /**
     * Find zero or one CustomerBots that matches the filter.
     * @param {CustomerBotsFindUniqueArgs} args - Arguments to find a CustomerBots
     * @example
     * // Get one CustomerBots
     * const customerBots = await prisma.customerBots.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CustomerBotsFindUniqueArgs>(args: SelectSubset<T, CustomerBotsFindUniqueArgs<ExtArgs>>): Prisma__CustomerBotsClient<$Result.GetResult<Prisma.$CustomerBotsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one CustomerBots that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CustomerBotsFindUniqueOrThrowArgs} args - Arguments to find a CustomerBots
     * @example
     * // Get one CustomerBots
     * const customerBots = await prisma.customerBots.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CustomerBotsFindUniqueOrThrowArgs>(args: SelectSubset<T, CustomerBotsFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CustomerBotsClient<$Result.GetResult<Prisma.$CustomerBotsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CustomerBots that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerBotsFindFirstArgs} args - Arguments to find a CustomerBots
     * @example
     * // Get one CustomerBots
     * const customerBots = await prisma.customerBots.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CustomerBotsFindFirstArgs>(args?: SelectSubset<T, CustomerBotsFindFirstArgs<ExtArgs>>): Prisma__CustomerBotsClient<$Result.GetResult<Prisma.$CustomerBotsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CustomerBots that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerBotsFindFirstOrThrowArgs} args - Arguments to find a CustomerBots
     * @example
     * // Get one CustomerBots
     * const customerBots = await prisma.customerBots.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CustomerBotsFindFirstOrThrowArgs>(args?: SelectSubset<T, CustomerBotsFindFirstOrThrowArgs<ExtArgs>>): Prisma__CustomerBotsClient<$Result.GetResult<Prisma.$CustomerBotsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more CustomerBots that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerBotsFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all CustomerBots
     * const customerBots = await prisma.customerBots.findMany()
     * 
     * // Get first 10 CustomerBots
     * const customerBots = await prisma.customerBots.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const customerBotsWithIdOnly = await prisma.customerBots.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CustomerBotsFindManyArgs>(args?: SelectSubset<T, CustomerBotsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomerBotsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a CustomerBots.
     * @param {CustomerBotsCreateArgs} args - Arguments to create a CustomerBots.
     * @example
     * // Create one CustomerBots
     * const CustomerBots = await prisma.customerBots.create({
     *   data: {
     *     // ... data to create a CustomerBots
     *   }
     * })
     * 
     */
    create<T extends CustomerBotsCreateArgs>(args: SelectSubset<T, CustomerBotsCreateArgs<ExtArgs>>): Prisma__CustomerBotsClient<$Result.GetResult<Prisma.$CustomerBotsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many CustomerBots.
     * @param {CustomerBotsCreateManyArgs} args - Arguments to create many CustomerBots.
     * @example
     * // Create many CustomerBots
     * const customerBots = await prisma.customerBots.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CustomerBotsCreateManyArgs>(args?: SelectSubset<T, CustomerBotsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many CustomerBots and returns the data saved in the database.
     * @param {CustomerBotsCreateManyAndReturnArgs} args - Arguments to create many CustomerBots.
     * @example
     * // Create many CustomerBots
     * const customerBots = await prisma.customerBots.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many CustomerBots and only return the `id`
     * const customerBotsWithIdOnly = await prisma.customerBots.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CustomerBotsCreateManyAndReturnArgs>(args?: SelectSubset<T, CustomerBotsCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomerBotsPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a CustomerBots.
     * @param {CustomerBotsDeleteArgs} args - Arguments to delete one CustomerBots.
     * @example
     * // Delete one CustomerBots
     * const CustomerBots = await prisma.customerBots.delete({
     *   where: {
     *     // ... filter to delete one CustomerBots
     *   }
     * })
     * 
     */
    delete<T extends CustomerBotsDeleteArgs>(args: SelectSubset<T, CustomerBotsDeleteArgs<ExtArgs>>): Prisma__CustomerBotsClient<$Result.GetResult<Prisma.$CustomerBotsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one CustomerBots.
     * @param {CustomerBotsUpdateArgs} args - Arguments to update one CustomerBots.
     * @example
     * // Update one CustomerBots
     * const customerBots = await prisma.customerBots.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CustomerBotsUpdateArgs>(args: SelectSubset<T, CustomerBotsUpdateArgs<ExtArgs>>): Prisma__CustomerBotsClient<$Result.GetResult<Prisma.$CustomerBotsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more CustomerBots.
     * @param {CustomerBotsDeleteManyArgs} args - Arguments to filter CustomerBots to delete.
     * @example
     * // Delete a few CustomerBots
     * const { count } = await prisma.customerBots.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CustomerBotsDeleteManyArgs>(args?: SelectSubset<T, CustomerBotsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CustomerBots.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerBotsUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many CustomerBots
     * const customerBots = await prisma.customerBots.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CustomerBotsUpdateManyArgs>(args: SelectSubset<T, CustomerBotsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CustomerBots and returns the data updated in the database.
     * @param {CustomerBotsUpdateManyAndReturnArgs} args - Arguments to update many CustomerBots.
     * @example
     * // Update many CustomerBots
     * const customerBots = await prisma.customerBots.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more CustomerBots and only return the `id`
     * const customerBotsWithIdOnly = await prisma.customerBots.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CustomerBotsUpdateManyAndReturnArgs>(args: SelectSubset<T, CustomerBotsUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomerBotsPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one CustomerBots.
     * @param {CustomerBotsUpsertArgs} args - Arguments to update or create a CustomerBots.
     * @example
     * // Update or create a CustomerBots
     * const customerBots = await prisma.customerBots.upsert({
     *   create: {
     *     // ... data to create a CustomerBots
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the CustomerBots we want to update
     *   }
     * })
     */
    upsert<T extends CustomerBotsUpsertArgs>(args: SelectSubset<T, CustomerBotsUpsertArgs<ExtArgs>>): Prisma__CustomerBotsClient<$Result.GetResult<Prisma.$CustomerBotsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of CustomerBots.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerBotsCountArgs} args - Arguments to filter CustomerBots to count.
     * @example
     * // Count the number of CustomerBots
     * const count = await prisma.customerBots.count({
     *   where: {
     *     // ... the filter for the CustomerBots we want to count
     *   }
     * })
    **/
    count<T extends CustomerBotsCountArgs>(
      args?: Subset<T, CustomerBotsCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CustomerBotsCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a CustomerBots.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerBotsAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CustomerBotsAggregateArgs>(args: Subset<T, CustomerBotsAggregateArgs>): Prisma.PrismaPromise<GetCustomerBotsAggregateType<T>>

    /**
     * Group by CustomerBots.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerBotsGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CustomerBotsGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CustomerBotsGroupByArgs['orderBy'] }
        : { orderBy?: CustomerBotsGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CustomerBotsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCustomerBotsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the CustomerBots model
   */
  readonly fields: CustomerBotsFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for CustomerBots.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CustomerBotsClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the CustomerBots model
   */
  interface CustomerBotsFieldRefs {
    readonly id: FieldRef<"CustomerBots", 'String'>
    readonly userId: FieldRef<"CustomerBots", 'String'>
    readonly botName: FieldRef<"CustomerBots", 'String'>
    readonly botAvatar: FieldRef<"CustomerBots", 'String'>
    readonly systemPrompt: FieldRef<"CustomerBots", 'String'>
    readonly settings: FieldRef<"CustomerBots", 'Json'>
    readonly active: FieldRef<"CustomerBots", 'Boolean'>
    readonly createdAt: FieldRef<"CustomerBots", 'DateTime'>
    readonly updatedAt: FieldRef<"CustomerBots", 'DateTime'>
    readonly isDeleted: FieldRef<"CustomerBots", 'Boolean'>
    readonly deletedAt: FieldRef<"CustomerBots", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * CustomerBots findUnique
   */
  export type CustomerBotsFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerBots
     */
    select?: CustomerBotsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerBots
     */
    omit?: CustomerBotsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerBotsInclude<ExtArgs> | null
    /**
     * Filter, which CustomerBots to fetch.
     */
    where: CustomerBotsWhereUniqueInput
  }

  /**
   * CustomerBots findUniqueOrThrow
   */
  export type CustomerBotsFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerBots
     */
    select?: CustomerBotsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerBots
     */
    omit?: CustomerBotsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerBotsInclude<ExtArgs> | null
    /**
     * Filter, which CustomerBots to fetch.
     */
    where: CustomerBotsWhereUniqueInput
  }

  /**
   * CustomerBots findFirst
   */
  export type CustomerBotsFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerBots
     */
    select?: CustomerBotsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerBots
     */
    omit?: CustomerBotsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerBotsInclude<ExtArgs> | null
    /**
     * Filter, which CustomerBots to fetch.
     */
    where?: CustomerBotsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomerBots to fetch.
     */
    orderBy?: CustomerBotsOrderByWithRelationInput | CustomerBotsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CustomerBots.
     */
    cursor?: CustomerBotsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomerBots from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomerBots.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CustomerBots.
     */
    distinct?: CustomerBotsScalarFieldEnum | CustomerBotsScalarFieldEnum[]
  }

  /**
   * CustomerBots findFirstOrThrow
   */
  export type CustomerBotsFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerBots
     */
    select?: CustomerBotsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerBots
     */
    omit?: CustomerBotsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerBotsInclude<ExtArgs> | null
    /**
     * Filter, which CustomerBots to fetch.
     */
    where?: CustomerBotsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomerBots to fetch.
     */
    orderBy?: CustomerBotsOrderByWithRelationInput | CustomerBotsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CustomerBots.
     */
    cursor?: CustomerBotsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomerBots from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomerBots.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CustomerBots.
     */
    distinct?: CustomerBotsScalarFieldEnum | CustomerBotsScalarFieldEnum[]
  }

  /**
   * CustomerBots findMany
   */
  export type CustomerBotsFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerBots
     */
    select?: CustomerBotsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerBots
     */
    omit?: CustomerBotsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerBotsInclude<ExtArgs> | null
    /**
     * Filter, which CustomerBots to fetch.
     */
    where?: CustomerBotsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomerBots to fetch.
     */
    orderBy?: CustomerBotsOrderByWithRelationInput | CustomerBotsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing CustomerBots.
     */
    cursor?: CustomerBotsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomerBots from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomerBots.
     */
    skip?: number
    distinct?: CustomerBotsScalarFieldEnum | CustomerBotsScalarFieldEnum[]
  }

  /**
   * CustomerBots create
   */
  export type CustomerBotsCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerBots
     */
    select?: CustomerBotsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerBots
     */
    omit?: CustomerBotsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerBotsInclude<ExtArgs> | null
    /**
     * The data needed to create a CustomerBots.
     */
    data: XOR<CustomerBotsCreateInput, CustomerBotsUncheckedCreateInput>
  }

  /**
   * CustomerBots createMany
   */
  export type CustomerBotsCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many CustomerBots.
     */
    data: CustomerBotsCreateManyInput | CustomerBotsCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * CustomerBots createManyAndReturn
   */
  export type CustomerBotsCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerBots
     */
    select?: CustomerBotsSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerBots
     */
    omit?: CustomerBotsOmit<ExtArgs> | null
    /**
     * The data used to create many CustomerBots.
     */
    data: CustomerBotsCreateManyInput | CustomerBotsCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerBotsIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * CustomerBots update
   */
  export type CustomerBotsUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerBots
     */
    select?: CustomerBotsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerBots
     */
    omit?: CustomerBotsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerBotsInclude<ExtArgs> | null
    /**
     * The data needed to update a CustomerBots.
     */
    data: XOR<CustomerBotsUpdateInput, CustomerBotsUncheckedUpdateInput>
    /**
     * Choose, which CustomerBots to update.
     */
    where: CustomerBotsWhereUniqueInput
  }

  /**
   * CustomerBots updateMany
   */
  export type CustomerBotsUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update CustomerBots.
     */
    data: XOR<CustomerBotsUpdateManyMutationInput, CustomerBotsUncheckedUpdateManyInput>
    /**
     * Filter which CustomerBots to update
     */
    where?: CustomerBotsWhereInput
    /**
     * Limit how many CustomerBots to update.
     */
    limit?: number
  }

  /**
   * CustomerBots updateManyAndReturn
   */
  export type CustomerBotsUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerBots
     */
    select?: CustomerBotsSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerBots
     */
    omit?: CustomerBotsOmit<ExtArgs> | null
    /**
     * The data used to update CustomerBots.
     */
    data: XOR<CustomerBotsUpdateManyMutationInput, CustomerBotsUncheckedUpdateManyInput>
    /**
     * Filter which CustomerBots to update
     */
    where?: CustomerBotsWhereInput
    /**
     * Limit how many CustomerBots to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerBotsIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * CustomerBots upsert
   */
  export type CustomerBotsUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerBots
     */
    select?: CustomerBotsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerBots
     */
    omit?: CustomerBotsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerBotsInclude<ExtArgs> | null
    /**
     * The filter to search for the CustomerBots to update in case it exists.
     */
    where: CustomerBotsWhereUniqueInput
    /**
     * In case the CustomerBots found by the `where` argument doesn't exist, create a new CustomerBots with this data.
     */
    create: XOR<CustomerBotsCreateInput, CustomerBotsUncheckedCreateInput>
    /**
     * In case the CustomerBots was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CustomerBotsUpdateInput, CustomerBotsUncheckedUpdateInput>
  }

  /**
   * CustomerBots delete
   */
  export type CustomerBotsDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerBots
     */
    select?: CustomerBotsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerBots
     */
    omit?: CustomerBotsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerBotsInclude<ExtArgs> | null
    /**
     * Filter which CustomerBots to delete.
     */
    where: CustomerBotsWhereUniqueInput
  }

  /**
   * CustomerBots deleteMany
   */
  export type CustomerBotsDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CustomerBots to delete
     */
    where?: CustomerBotsWhereInput
    /**
     * Limit how many CustomerBots to delete.
     */
    limit?: number
  }

  /**
   * CustomerBots without action
   */
  export type CustomerBotsDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerBots
     */
    select?: CustomerBotsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerBots
     */
    omit?: CustomerBotsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerBotsInclude<ExtArgs> | null
  }


  /**
   * Model CustomerChats
   */

  export type AggregateCustomerChats = {
    _count: CustomerChatsCountAggregateOutputType | null
    _avg: CustomerChatsAvgAggregateOutputType | null
    _sum: CustomerChatsSumAggregateOutputType | null
    _min: CustomerChatsMinAggregateOutputType | null
    _max: CustomerChatsMaxAggregateOutputType | null
  }

  export type CustomerChatsAvgAggregateOutputType = {
    totalTokens: number | null
  }

  export type CustomerChatsSumAggregateOutputType = {
    totalTokens: number | null
  }

  export type CustomerChatsMinAggregateOutputType = {
    id: string | null
    userId: string | null
    botId: string | null
    chatId: string | null
    createdAt: Date | null
    updatedAt: Date | null
    isDeleted: boolean | null
    deletedAt: Date | null
    totalTokens: number | null
  }

  export type CustomerChatsMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    botId: string | null
    chatId: string | null
    createdAt: Date | null
    updatedAt: Date | null
    isDeleted: boolean | null
    deletedAt: Date | null
    totalTokens: number | null
  }

  export type CustomerChatsCountAggregateOutputType = {
    id: number
    userId: number
    botId: number
    chatId: number
    createdAt: number
    updatedAt: number
    isDeleted: number
    deletedAt: number
    totalTokens: number
    _all: number
  }


  export type CustomerChatsAvgAggregateInputType = {
    totalTokens?: true
  }

  export type CustomerChatsSumAggregateInputType = {
    totalTokens?: true
  }

  export type CustomerChatsMinAggregateInputType = {
    id?: true
    userId?: true
    botId?: true
    chatId?: true
    createdAt?: true
    updatedAt?: true
    isDeleted?: true
    deletedAt?: true
    totalTokens?: true
  }

  export type CustomerChatsMaxAggregateInputType = {
    id?: true
    userId?: true
    botId?: true
    chatId?: true
    createdAt?: true
    updatedAt?: true
    isDeleted?: true
    deletedAt?: true
    totalTokens?: true
  }

  export type CustomerChatsCountAggregateInputType = {
    id?: true
    userId?: true
    botId?: true
    chatId?: true
    createdAt?: true
    updatedAt?: true
    isDeleted?: true
    deletedAt?: true
    totalTokens?: true
    _all?: true
  }

  export type CustomerChatsAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CustomerChats to aggregate.
     */
    where?: CustomerChatsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomerChats to fetch.
     */
    orderBy?: CustomerChatsOrderByWithRelationInput | CustomerChatsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CustomerChatsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomerChats from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomerChats.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned CustomerChats
    **/
    _count?: true | CustomerChatsCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: CustomerChatsAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: CustomerChatsSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CustomerChatsMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CustomerChatsMaxAggregateInputType
  }

  export type GetCustomerChatsAggregateType<T extends CustomerChatsAggregateArgs> = {
        [P in keyof T & keyof AggregateCustomerChats]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCustomerChats[P]>
      : GetScalarType<T[P], AggregateCustomerChats[P]>
  }




  export type CustomerChatsGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CustomerChatsWhereInput
    orderBy?: CustomerChatsOrderByWithAggregationInput | CustomerChatsOrderByWithAggregationInput[]
    by: CustomerChatsScalarFieldEnum[] | CustomerChatsScalarFieldEnum
    having?: CustomerChatsScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CustomerChatsCountAggregateInputType | true
    _avg?: CustomerChatsAvgAggregateInputType
    _sum?: CustomerChatsSumAggregateInputType
    _min?: CustomerChatsMinAggregateInputType
    _max?: CustomerChatsMaxAggregateInputType
  }

  export type CustomerChatsGroupByOutputType = {
    id: string
    userId: string
    botId: string
    chatId: string
    createdAt: Date
    updatedAt: Date
    isDeleted: boolean
    deletedAt: Date | null
    totalTokens: number | null
    _count: CustomerChatsCountAggregateOutputType | null
    _avg: CustomerChatsAvgAggregateOutputType | null
    _sum: CustomerChatsSumAggregateOutputType | null
    _min: CustomerChatsMinAggregateOutputType | null
    _max: CustomerChatsMaxAggregateOutputType | null
  }

  type GetCustomerChatsGroupByPayload<T extends CustomerChatsGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CustomerChatsGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CustomerChatsGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CustomerChatsGroupByOutputType[P]>
            : GetScalarType<T[P], CustomerChatsGroupByOutputType[P]>
        }
      >
    >


  export type CustomerChatsSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    botId?: boolean
    chatId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    isDeleted?: boolean
    deletedAt?: boolean
    totalTokens?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    CustomerChatDetails?: boolean | CustomerChats$CustomerChatDetailsArgs<ExtArgs>
    GeoLocation?: boolean | CustomerChats$GeoLocationArgs<ExtArgs>
    _count?: boolean | CustomerChatsCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["customerChats"]>

  export type CustomerChatsSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    botId?: boolean
    chatId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    isDeleted?: boolean
    deletedAt?: boolean
    totalTokens?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["customerChats"]>

  export type CustomerChatsSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    botId?: boolean
    chatId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    isDeleted?: boolean
    deletedAt?: boolean
    totalTokens?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["customerChats"]>

  export type CustomerChatsSelectScalar = {
    id?: boolean
    userId?: boolean
    botId?: boolean
    chatId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    isDeleted?: boolean
    deletedAt?: boolean
    totalTokens?: boolean
  }

  export type CustomerChatsOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "botId" | "chatId" | "createdAt" | "updatedAt" | "isDeleted" | "deletedAt" | "totalTokens", ExtArgs["result"]["customerChats"]>
  export type CustomerChatsInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    CustomerChatDetails?: boolean | CustomerChats$CustomerChatDetailsArgs<ExtArgs>
    GeoLocation?: boolean | CustomerChats$GeoLocationArgs<ExtArgs>
    _count?: boolean | CustomerChatsCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type CustomerChatsIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type CustomerChatsIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $CustomerChatsPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "CustomerChats"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
      CustomerChatDetails: Prisma.$CustomerChatDetailsPayload<ExtArgs>[]
      GeoLocation: Prisma.$GeoLocationPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      botId: string
      chatId: string
      createdAt: Date
      updatedAt: Date
      isDeleted: boolean
      deletedAt: Date | null
      totalTokens: number | null
    }, ExtArgs["result"]["customerChats"]>
    composites: {}
  }

  type CustomerChatsGetPayload<S extends boolean | null | undefined | CustomerChatsDefaultArgs> = $Result.GetResult<Prisma.$CustomerChatsPayload, S>

  type CustomerChatsCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CustomerChatsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CustomerChatsCountAggregateInputType | true
    }

  export interface CustomerChatsDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['CustomerChats'], meta: { name: 'CustomerChats' } }
    /**
     * Find zero or one CustomerChats that matches the filter.
     * @param {CustomerChatsFindUniqueArgs} args - Arguments to find a CustomerChats
     * @example
     * // Get one CustomerChats
     * const customerChats = await prisma.customerChats.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CustomerChatsFindUniqueArgs>(args: SelectSubset<T, CustomerChatsFindUniqueArgs<ExtArgs>>): Prisma__CustomerChatsClient<$Result.GetResult<Prisma.$CustomerChatsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one CustomerChats that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CustomerChatsFindUniqueOrThrowArgs} args - Arguments to find a CustomerChats
     * @example
     * // Get one CustomerChats
     * const customerChats = await prisma.customerChats.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CustomerChatsFindUniqueOrThrowArgs>(args: SelectSubset<T, CustomerChatsFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CustomerChatsClient<$Result.GetResult<Prisma.$CustomerChatsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CustomerChats that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerChatsFindFirstArgs} args - Arguments to find a CustomerChats
     * @example
     * // Get one CustomerChats
     * const customerChats = await prisma.customerChats.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CustomerChatsFindFirstArgs>(args?: SelectSubset<T, CustomerChatsFindFirstArgs<ExtArgs>>): Prisma__CustomerChatsClient<$Result.GetResult<Prisma.$CustomerChatsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CustomerChats that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerChatsFindFirstOrThrowArgs} args - Arguments to find a CustomerChats
     * @example
     * // Get one CustomerChats
     * const customerChats = await prisma.customerChats.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CustomerChatsFindFirstOrThrowArgs>(args?: SelectSubset<T, CustomerChatsFindFirstOrThrowArgs<ExtArgs>>): Prisma__CustomerChatsClient<$Result.GetResult<Prisma.$CustomerChatsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more CustomerChats that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerChatsFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all CustomerChats
     * const customerChats = await prisma.customerChats.findMany()
     * 
     * // Get first 10 CustomerChats
     * const customerChats = await prisma.customerChats.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const customerChatsWithIdOnly = await prisma.customerChats.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CustomerChatsFindManyArgs>(args?: SelectSubset<T, CustomerChatsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomerChatsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a CustomerChats.
     * @param {CustomerChatsCreateArgs} args - Arguments to create a CustomerChats.
     * @example
     * // Create one CustomerChats
     * const CustomerChats = await prisma.customerChats.create({
     *   data: {
     *     // ... data to create a CustomerChats
     *   }
     * })
     * 
     */
    create<T extends CustomerChatsCreateArgs>(args: SelectSubset<T, CustomerChatsCreateArgs<ExtArgs>>): Prisma__CustomerChatsClient<$Result.GetResult<Prisma.$CustomerChatsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many CustomerChats.
     * @param {CustomerChatsCreateManyArgs} args - Arguments to create many CustomerChats.
     * @example
     * // Create many CustomerChats
     * const customerChats = await prisma.customerChats.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CustomerChatsCreateManyArgs>(args?: SelectSubset<T, CustomerChatsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many CustomerChats and returns the data saved in the database.
     * @param {CustomerChatsCreateManyAndReturnArgs} args - Arguments to create many CustomerChats.
     * @example
     * // Create many CustomerChats
     * const customerChats = await prisma.customerChats.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many CustomerChats and only return the `id`
     * const customerChatsWithIdOnly = await prisma.customerChats.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CustomerChatsCreateManyAndReturnArgs>(args?: SelectSubset<T, CustomerChatsCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomerChatsPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a CustomerChats.
     * @param {CustomerChatsDeleteArgs} args - Arguments to delete one CustomerChats.
     * @example
     * // Delete one CustomerChats
     * const CustomerChats = await prisma.customerChats.delete({
     *   where: {
     *     // ... filter to delete one CustomerChats
     *   }
     * })
     * 
     */
    delete<T extends CustomerChatsDeleteArgs>(args: SelectSubset<T, CustomerChatsDeleteArgs<ExtArgs>>): Prisma__CustomerChatsClient<$Result.GetResult<Prisma.$CustomerChatsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one CustomerChats.
     * @param {CustomerChatsUpdateArgs} args - Arguments to update one CustomerChats.
     * @example
     * // Update one CustomerChats
     * const customerChats = await prisma.customerChats.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CustomerChatsUpdateArgs>(args: SelectSubset<T, CustomerChatsUpdateArgs<ExtArgs>>): Prisma__CustomerChatsClient<$Result.GetResult<Prisma.$CustomerChatsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more CustomerChats.
     * @param {CustomerChatsDeleteManyArgs} args - Arguments to filter CustomerChats to delete.
     * @example
     * // Delete a few CustomerChats
     * const { count } = await prisma.customerChats.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CustomerChatsDeleteManyArgs>(args?: SelectSubset<T, CustomerChatsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CustomerChats.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerChatsUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many CustomerChats
     * const customerChats = await prisma.customerChats.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CustomerChatsUpdateManyArgs>(args: SelectSubset<T, CustomerChatsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CustomerChats and returns the data updated in the database.
     * @param {CustomerChatsUpdateManyAndReturnArgs} args - Arguments to update many CustomerChats.
     * @example
     * // Update many CustomerChats
     * const customerChats = await prisma.customerChats.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more CustomerChats and only return the `id`
     * const customerChatsWithIdOnly = await prisma.customerChats.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CustomerChatsUpdateManyAndReturnArgs>(args: SelectSubset<T, CustomerChatsUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomerChatsPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one CustomerChats.
     * @param {CustomerChatsUpsertArgs} args - Arguments to update or create a CustomerChats.
     * @example
     * // Update or create a CustomerChats
     * const customerChats = await prisma.customerChats.upsert({
     *   create: {
     *     // ... data to create a CustomerChats
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the CustomerChats we want to update
     *   }
     * })
     */
    upsert<T extends CustomerChatsUpsertArgs>(args: SelectSubset<T, CustomerChatsUpsertArgs<ExtArgs>>): Prisma__CustomerChatsClient<$Result.GetResult<Prisma.$CustomerChatsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of CustomerChats.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerChatsCountArgs} args - Arguments to filter CustomerChats to count.
     * @example
     * // Count the number of CustomerChats
     * const count = await prisma.customerChats.count({
     *   where: {
     *     // ... the filter for the CustomerChats we want to count
     *   }
     * })
    **/
    count<T extends CustomerChatsCountArgs>(
      args?: Subset<T, CustomerChatsCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CustomerChatsCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a CustomerChats.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerChatsAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CustomerChatsAggregateArgs>(args: Subset<T, CustomerChatsAggregateArgs>): Prisma.PrismaPromise<GetCustomerChatsAggregateType<T>>

    /**
     * Group by CustomerChats.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerChatsGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CustomerChatsGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CustomerChatsGroupByArgs['orderBy'] }
        : { orderBy?: CustomerChatsGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CustomerChatsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCustomerChatsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the CustomerChats model
   */
  readonly fields: CustomerChatsFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for CustomerChats.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CustomerChatsClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    CustomerChatDetails<T extends CustomerChats$CustomerChatDetailsArgs<ExtArgs> = {}>(args?: Subset<T, CustomerChats$CustomerChatDetailsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomerChatDetailsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    GeoLocation<T extends CustomerChats$GeoLocationArgs<ExtArgs> = {}>(args?: Subset<T, CustomerChats$GeoLocationArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GeoLocationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the CustomerChats model
   */
  interface CustomerChatsFieldRefs {
    readonly id: FieldRef<"CustomerChats", 'String'>
    readonly userId: FieldRef<"CustomerChats", 'String'>
    readonly botId: FieldRef<"CustomerChats", 'String'>
    readonly chatId: FieldRef<"CustomerChats", 'String'>
    readonly createdAt: FieldRef<"CustomerChats", 'DateTime'>
    readonly updatedAt: FieldRef<"CustomerChats", 'DateTime'>
    readonly isDeleted: FieldRef<"CustomerChats", 'Boolean'>
    readonly deletedAt: FieldRef<"CustomerChats", 'DateTime'>
    readonly totalTokens: FieldRef<"CustomerChats", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * CustomerChats findUnique
   */
  export type CustomerChatsFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChats
     */
    select?: CustomerChatsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChats
     */
    omit?: CustomerChatsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatsInclude<ExtArgs> | null
    /**
     * Filter, which CustomerChats to fetch.
     */
    where: CustomerChatsWhereUniqueInput
  }

  /**
   * CustomerChats findUniqueOrThrow
   */
  export type CustomerChatsFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChats
     */
    select?: CustomerChatsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChats
     */
    omit?: CustomerChatsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatsInclude<ExtArgs> | null
    /**
     * Filter, which CustomerChats to fetch.
     */
    where: CustomerChatsWhereUniqueInput
  }

  /**
   * CustomerChats findFirst
   */
  export type CustomerChatsFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChats
     */
    select?: CustomerChatsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChats
     */
    omit?: CustomerChatsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatsInclude<ExtArgs> | null
    /**
     * Filter, which CustomerChats to fetch.
     */
    where?: CustomerChatsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomerChats to fetch.
     */
    orderBy?: CustomerChatsOrderByWithRelationInput | CustomerChatsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CustomerChats.
     */
    cursor?: CustomerChatsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomerChats from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomerChats.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CustomerChats.
     */
    distinct?: CustomerChatsScalarFieldEnum | CustomerChatsScalarFieldEnum[]
  }

  /**
   * CustomerChats findFirstOrThrow
   */
  export type CustomerChatsFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChats
     */
    select?: CustomerChatsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChats
     */
    omit?: CustomerChatsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatsInclude<ExtArgs> | null
    /**
     * Filter, which CustomerChats to fetch.
     */
    where?: CustomerChatsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomerChats to fetch.
     */
    orderBy?: CustomerChatsOrderByWithRelationInput | CustomerChatsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CustomerChats.
     */
    cursor?: CustomerChatsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomerChats from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomerChats.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CustomerChats.
     */
    distinct?: CustomerChatsScalarFieldEnum | CustomerChatsScalarFieldEnum[]
  }

  /**
   * CustomerChats findMany
   */
  export type CustomerChatsFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChats
     */
    select?: CustomerChatsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChats
     */
    omit?: CustomerChatsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatsInclude<ExtArgs> | null
    /**
     * Filter, which CustomerChats to fetch.
     */
    where?: CustomerChatsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomerChats to fetch.
     */
    orderBy?: CustomerChatsOrderByWithRelationInput | CustomerChatsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing CustomerChats.
     */
    cursor?: CustomerChatsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomerChats from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomerChats.
     */
    skip?: number
    distinct?: CustomerChatsScalarFieldEnum | CustomerChatsScalarFieldEnum[]
  }

  /**
   * CustomerChats create
   */
  export type CustomerChatsCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChats
     */
    select?: CustomerChatsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChats
     */
    omit?: CustomerChatsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatsInclude<ExtArgs> | null
    /**
     * The data needed to create a CustomerChats.
     */
    data: XOR<CustomerChatsCreateInput, CustomerChatsUncheckedCreateInput>
  }

  /**
   * CustomerChats createMany
   */
  export type CustomerChatsCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many CustomerChats.
     */
    data: CustomerChatsCreateManyInput | CustomerChatsCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * CustomerChats createManyAndReturn
   */
  export type CustomerChatsCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChats
     */
    select?: CustomerChatsSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChats
     */
    omit?: CustomerChatsOmit<ExtArgs> | null
    /**
     * The data used to create many CustomerChats.
     */
    data: CustomerChatsCreateManyInput | CustomerChatsCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatsIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * CustomerChats update
   */
  export type CustomerChatsUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChats
     */
    select?: CustomerChatsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChats
     */
    omit?: CustomerChatsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatsInclude<ExtArgs> | null
    /**
     * The data needed to update a CustomerChats.
     */
    data: XOR<CustomerChatsUpdateInput, CustomerChatsUncheckedUpdateInput>
    /**
     * Choose, which CustomerChats to update.
     */
    where: CustomerChatsWhereUniqueInput
  }

  /**
   * CustomerChats updateMany
   */
  export type CustomerChatsUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update CustomerChats.
     */
    data: XOR<CustomerChatsUpdateManyMutationInput, CustomerChatsUncheckedUpdateManyInput>
    /**
     * Filter which CustomerChats to update
     */
    where?: CustomerChatsWhereInput
    /**
     * Limit how many CustomerChats to update.
     */
    limit?: number
  }

  /**
   * CustomerChats updateManyAndReturn
   */
  export type CustomerChatsUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChats
     */
    select?: CustomerChatsSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChats
     */
    omit?: CustomerChatsOmit<ExtArgs> | null
    /**
     * The data used to update CustomerChats.
     */
    data: XOR<CustomerChatsUpdateManyMutationInput, CustomerChatsUncheckedUpdateManyInput>
    /**
     * Filter which CustomerChats to update
     */
    where?: CustomerChatsWhereInput
    /**
     * Limit how many CustomerChats to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatsIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * CustomerChats upsert
   */
  export type CustomerChatsUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChats
     */
    select?: CustomerChatsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChats
     */
    omit?: CustomerChatsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatsInclude<ExtArgs> | null
    /**
     * The filter to search for the CustomerChats to update in case it exists.
     */
    where: CustomerChatsWhereUniqueInput
    /**
     * In case the CustomerChats found by the `where` argument doesn't exist, create a new CustomerChats with this data.
     */
    create: XOR<CustomerChatsCreateInput, CustomerChatsUncheckedCreateInput>
    /**
     * In case the CustomerChats was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CustomerChatsUpdateInput, CustomerChatsUncheckedUpdateInput>
  }

  /**
   * CustomerChats delete
   */
  export type CustomerChatsDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChats
     */
    select?: CustomerChatsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChats
     */
    omit?: CustomerChatsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatsInclude<ExtArgs> | null
    /**
     * Filter which CustomerChats to delete.
     */
    where: CustomerChatsWhereUniqueInput
  }

  /**
   * CustomerChats deleteMany
   */
  export type CustomerChatsDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CustomerChats to delete
     */
    where?: CustomerChatsWhereInput
    /**
     * Limit how many CustomerChats to delete.
     */
    limit?: number
  }

  /**
   * CustomerChats.CustomerChatDetails
   */
  export type CustomerChats$CustomerChatDetailsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChatDetails
     */
    select?: CustomerChatDetailsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChatDetails
     */
    omit?: CustomerChatDetailsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatDetailsInclude<ExtArgs> | null
    where?: CustomerChatDetailsWhereInput
    orderBy?: CustomerChatDetailsOrderByWithRelationInput | CustomerChatDetailsOrderByWithRelationInput[]
    cursor?: CustomerChatDetailsWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CustomerChatDetailsScalarFieldEnum | CustomerChatDetailsScalarFieldEnum[]
  }

  /**
   * CustomerChats.GeoLocation
   */
  export type CustomerChats$GeoLocationArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GeoLocation
     */
    select?: GeoLocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GeoLocation
     */
    omit?: GeoLocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GeoLocationInclude<ExtArgs> | null
    where?: GeoLocationWhereInput
    orderBy?: GeoLocationOrderByWithRelationInput | GeoLocationOrderByWithRelationInput[]
    cursor?: GeoLocationWhereUniqueInput
    take?: number
    skip?: number
    distinct?: GeoLocationScalarFieldEnum | GeoLocationScalarFieldEnum[]
  }

  /**
   * CustomerChats without action
   */
  export type CustomerChatsDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChats
     */
    select?: CustomerChatsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChats
     */
    omit?: CustomerChatsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatsInclude<ExtArgs> | null
  }


  /**
   * Model CustomerChatDetails
   */

  export type AggregateCustomerChatDetails = {
    _count: CustomerChatDetailsCountAggregateOutputType | null
    _min: CustomerChatDetailsMinAggregateOutputType | null
    _max: CustomerChatDetailsMaxAggregateOutputType | null
  }

  export type CustomerChatDetailsMinAggregateOutputType = {
    id: string | null
    chatId: string | null
    message: string | null
    sender: string | null
    createdAt: Date | null
  }

  export type CustomerChatDetailsMaxAggregateOutputType = {
    id: string | null
    chatId: string | null
    message: string | null
    sender: string | null
    createdAt: Date | null
  }

  export type CustomerChatDetailsCountAggregateOutputType = {
    id: number
    chatId: number
    message: number
    sender: number
    tokenDetails: number
    createdAt: number
    _all: number
  }


  export type CustomerChatDetailsMinAggregateInputType = {
    id?: true
    chatId?: true
    message?: true
    sender?: true
    createdAt?: true
  }

  export type CustomerChatDetailsMaxAggregateInputType = {
    id?: true
    chatId?: true
    message?: true
    sender?: true
    createdAt?: true
  }

  export type CustomerChatDetailsCountAggregateInputType = {
    id?: true
    chatId?: true
    message?: true
    sender?: true
    tokenDetails?: true
    createdAt?: true
    _all?: true
  }

  export type CustomerChatDetailsAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CustomerChatDetails to aggregate.
     */
    where?: CustomerChatDetailsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomerChatDetails to fetch.
     */
    orderBy?: CustomerChatDetailsOrderByWithRelationInput | CustomerChatDetailsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CustomerChatDetailsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomerChatDetails from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomerChatDetails.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned CustomerChatDetails
    **/
    _count?: true | CustomerChatDetailsCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CustomerChatDetailsMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CustomerChatDetailsMaxAggregateInputType
  }

  export type GetCustomerChatDetailsAggregateType<T extends CustomerChatDetailsAggregateArgs> = {
        [P in keyof T & keyof AggregateCustomerChatDetails]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCustomerChatDetails[P]>
      : GetScalarType<T[P], AggregateCustomerChatDetails[P]>
  }




  export type CustomerChatDetailsGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CustomerChatDetailsWhereInput
    orderBy?: CustomerChatDetailsOrderByWithAggregationInput | CustomerChatDetailsOrderByWithAggregationInput[]
    by: CustomerChatDetailsScalarFieldEnum[] | CustomerChatDetailsScalarFieldEnum
    having?: CustomerChatDetailsScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CustomerChatDetailsCountAggregateInputType | true
    _min?: CustomerChatDetailsMinAggregateInputType
    _max?: CustomerChatDetailsMaxAggregateInputType
  }

  export type CustomerChatDetailsGroupByOutputType = {
    id: string
    chatId: string
    message: string
    sender: string
    tokenDetails: JsonValue | null
    createdAt: Date
    _count: CustomerChatDetailsCountAggregateOutputType | null
    _min: CustomerChatDetailsMinAggregateOutputType | null
    _max: CustomerChatDetailsMaxAggregateOutputType | null
  }

  type GetCustomerChatDetailsGroupByPayload<T extends CustomerChatDetailsGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CustomerChatDetailsGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CustomerChatDetailsGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CustomerChatDetailsGroupByOutputType[P]>
            : GetScalarType<T[P], CustomerChatDetailsGroupByOutputType[P]>
        }
      >
    >


  export type CustomerChatDetailsSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    chatId?: boolean
    message?: boolean
    sender?: boolean
    tokenDetails?: boolean
    createdAt?: boolean
    chat?: boolean | CustomerChatsDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["customerChatDetails"]>

  export type CustomerChatDetailsSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    chatId?: boolean
    message?: boolean
    sender?: boolean
    tokenDetails?: boolean
    createdAt?: boolean
    chat?: boolean | CustomerChatsDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["customerChatDetails"]>

  export type CustomerChatDetailsSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    chatId?: boolean
    message?: boolean
    sender?: boolean
    tokenDetails?: boolean
    createdAt?: boolean
    chat?: boolean | CustomerChatsDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["customerChatDetails"]>

  export type CustomerChatDetailsSelectScalar = {
    id?: boolean
    chatId?: boolean
    message?: boolean
    sender?: boolean
    tokenDetails?: boolean
    createdAt?: boolean
  }

  export type CustomerChatDetailsOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "chatId" | "message" | "sender" | "tokenDetails" | "createdAt", ExtArgs["result"]["customerChatDetails"]>
  export type CustomerChatDetailsInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    chat?: boolean | CustomerChatsDefaultArgs<ExtArgs>
  }
  export type CustomerChatDetailsIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    chat?: boolean | CustomerChatsDefaultArgs<ExtArgs>
  }
  export type CustomerChatDetailsIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    chat?: boolean | CustomerChatsDefaultArgs<ExtArgs>
  }

  export type $CustomerChatDetailsPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "CustomerChatDetails"
    objects: {
      chat: Prisma.$CustomerChatsPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      chatId: string
      message: string
      sender: string
      tokenDetails: Prisma.JsonValue | null
      createdAt: Date
    }, ExtArgs["result"]["customerChatDetails"]>
    composites: {}
  }

  type CustomerChatDetailsGetPayload<S extends boolean | null | undefined | CustomerChatDetailsDefaultArgs> = $Result.GetResult<Prisma.$CustomerChatDetailsPayload, S>

  type CustomerChatDetailsCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CustomerChatDetailsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CustomerChatDetailsCountAggregateInputType | true
    }

  export interface CustomerChatDetailsDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['CustomerChatDetails'], meta: { name: 'CustomerChatDetails' } }
    /**
     * Find zero or one CustomerChatDetails that matches the filter.
     * @param {CustomerChatDetailsFindUniqueArgs} args - Arguments to find a CustomerChatDetails
     * @example
     * // Get one CustomerChatDetails
     * const customerChatDetails = await prisma.customerChatDetails.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CustomerChatDetailsFindUniqueArgs>(args: SelectSubset<T, CustomerChatDetailsFindUniqueArgs<ExtArgs>>): Prisma__CustomerChatDetailsClient<$Result.GetResult<Prisma.$CustomerChatDetailsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one CustomerChatDetails that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CustomerChatDetailsFindUniqueOrThrowArgs} args - Arguments to find a CustomerChatDetails
     * @example
     * // Get one CustomerChatDetails
     * const customerChatDetails = await prisma.customerChatDetails.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CustomerChatDetailsFindUniqueOrThrowArgs>(args: SelectSubset<T, CustomerChatDetailsFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CustomerChatDetailsClient<$Result.GetResult<Prisma.$CustomerChatDetailsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CustomerChatDetails that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerChatDetailsFindFirstArgs} args - Arguments to find a CustomerChatDetails
     * @example
     * // Get one CustomerChatDetails
     * const customerChatDetails = await prisma.customerChatDetails.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CustomerChatDetailsFindFirstArgs>(args?: SelectSubset<T, CustomerChatDetailsFindFirstArgs<ExtArgs>>): Prisma__CustomerChatDetailsClient<$Result.GetResult<Prisma.$CustomerChatDetailsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CustomerChatDetails that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerChatDetailsFindFirstOrThrowArgs} args - Arguments to find a CustomerChatDetails
     * @example
     * // Get one CustomerChatDetails
     * const customerChatDetails = await prisma.customerChatDetails.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CustomerChatDetailsFindFirstOrThrowArgs>(args?: SelectSubset<T, CustomerChatDetailsFindFirstOrThrowArgs<ExtArgs>>): Prisma__CustomerChatDetailsClient<$Result.GetResult<Prisma.$CustomerChatDetailsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more CustomerChatDetails that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerChatDetailsFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all CustomerChatDetails
     * const customerChatDetails = await prisma.customerChatDetails.findMany()
     * 
     * // Get first 10 CustomerChatDetails
     * const customerChatDetails = await prisma.customerChatDetails.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const customerChatDetailsWithIdOnly = await prisma.customerChatDetails.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CustomerChatDetailsFindManyArgs>(args?: SelectSubset<T, CustomerChatDetailsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomerChatDetailsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a CustomerChatDetails.
     * @param {CustomerChatDetailsCreateArgs} args - Arguments to create a CustomerChatDetails.
     * @example
     * // Create one CustomerChatDetails
     * const CustomerChatDetails = await prisma.customerChatDetails.create({
     *   data: {
     *     // ... data to create a CustomerChatDetails
     *   }
     * })
     * 
     */
    create<T extends CustomerChatDetailsCreateArgs>(args: SelectSubset<T, CustomerChatDetailsCreateArgs<ExtArgs>>): Prisma__CustomerChatDetailsClient<$Result.GetResult<Prisma.$CustomerChatDetailsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many CustomerChatDetails.
     * @param {CustomerChatDetailsCreateManyArgs} args - Arguments to create many CustomerChatDetails.
     * @example
     * // Create many CustomerChatDetails
     * const customerChatDetails = await prisma.customerChatDetails.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CustomerChatDetailsCreateManyArgs>(args?: SelectSubset<T, CustomerChatDetailsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many CustomerChatDetails and returns the data saved in the database.
     * @param {CustomerChatDetailsCreateManyAndReturnArgs} args - Arguments to create many CustomerChatDetails.
     * @example
     * // Create many CustomerChatDetails
     * const customerChatDetails = await prisma.customerChatDetails.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many CustomerChatDetails and only return the `id`
     * const customerChatDetailsWithIdOnly = await prisma.customerChatDetails.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CustomerChatDetailsCreateManyAndReturnArgs>(args?: SelectSubset<T, CustomerChatDetailsCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomerChatDetailsPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a CustomerChatDetails.
     * @param {CustomerChatDetailsDeleteArgs} args - Arguments to delete one CustomerChatDetails.
     * @example
     * // Delete one CustomerChatDetails
     * const CustomerChatDetails = await prisma.customerChatDetails.delete({
     *   where: {
     *     // ... filter to delete one CustomerChatDetails
     *   }
     * })
     * 
     */
    delete<T extends CustomerChatDetailsDeleteArgs>(args: SelectSubset<T, CustomerChatDetailsDeleteArgs<ExtArgs>>): Prisma__CustomerChatDetailsClient<$Result.GetResult<Prisma.$CustomerChatDetailsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one CustomerChatDetails.
     * @param {CustomerChatDetailsUpdateArgs} args - Arguments to update one CustomerChatDetails.
     * @example
     * // Update one CustomerChatDetails
     * const customerChatDetails = await prisma.customerChatDetails.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CustomerChatDetailsUpdateArgs>(args: SelectSubset<T, CustomerChatDetailsUpdateArgs<ExtArgs>>): Prisma__CustomerChatDetailsClient<$Result.GetResult<Prisma.$CustomerChatDetailsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more CustomerChatDetails.
     * @param {CustomerChatDetailsDeleteManyArgs} args - Arguments to filter CustomerChatDetails to delete.
     * @example
     * // Delete a few CustomerChatDetails
     * const { count } = await prisma.customerChatDetails.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CustomerChatDetailsDeleteManyArgs>(args?: SelectSubset<T, CustomerChatDetailsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CustomerChatDetails.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerChatDetailsUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many CustomerChatDetails
     * const customerChatDetails = await prisma.customerChatDetails.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CustomerChatDetailsUpdateManyArgs>(args: SelectSubset<T, CustomerChatDetailsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CustomerChatDetails and returns the data updated in the database.
     * @param {CustomerChatDetailsUpdateManyAndReturnArgs} args - Arguments to update many CustomerChatDetails.
     * @example
     * // Update many CustomerChatDetails
     * const customerChatDetails = await prisma.customerChatDetails.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more CustomerChatDetails and only return the `id`
     * const customerChatDetailsWithIdOnly = await prisma.customerChatDetails.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CustomerChatDetailsUpdateManyAndReturnArgs>(args: SelectSubset<T, CustomerChatDetailsUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomerChatDetailsPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one CustomerChatDetails.
     * @param {CustomerChatDetailsUpsertArgs} args - Arguments to update or create a CustomerChatDetails.
     * @example
     * // Update or create a CustomerChatDetails
     * const customerChatDetails = await prisma.customerChatDetails.upsert({
     *   create: {
     *     // ... data to create a CustomerChatDetails
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the CustomerChatDetails we want to update
     *   }
     * })
     */
    upsert<T extends CustomerChatDetailsUpsertArgs>(args: SelectSubset<T, CustomerChatDetailsUpsertArgs<ExtArgs>>): Prisma__CustomerChatDetailsClient<$Result.GetResult<Prisma.$CustomerChatDetailsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of CustomerChatDetails.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerChatDetailsCountArgs} args - Arguments to filter CustomerChatDetails to count.
     * @example
     * // Count the number of CustomerChatDetails
     * const count = await prisma.customerChatDetails.count({
     *   where: {
     *     // ... the filter for the CustomerChatDetails we want to count
     *   }
     * })
    **/
    count<T extends CustomerChatDetailsCountArgs>(
      args?: Subset<T, CustomerChatDetailsCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CustomerChatDetailsCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a CustomerChatDetails.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerChatDetailsAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CustomerChatDetailsAggregateArgs>(args: Subset<T, CustomerChatDetailsAggregateArgs>): Prisma.PrismaPromise<GetCustomerChatDetailsAggregateType<T>>

    /**
     * Group by CustomerChatDetails.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerChatDetailsGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CustomerChatDetailsGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CustomerChatDetailsGroupByArgs['orderBy'] }
        : { orderBy?: CustomerChatDetailsGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CustomerChatDetailsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCustomerChatDetailsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the CustomerChatDetails model
   */
  readonly fields: CustomerChatDetailsFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for CustomerChatDetails.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CustomerChatDetailsClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    chat<T extends CustomerChatsDefaultArgs<ExtArgs> = {}>(args?: Subset<T, CustomerChatsDefaultArgs<ExtArgs>>): Prisma__CustomerChatsClient<$Result.GetResult<Prisma.$CustomerChatsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the CustomerChatDetails model
   */
  interface CustomerChatDetailsFieldRefs {
    readonly id: FieldRef<"CustomerChatDetails", 'String'>
    readonly chatId: FieldRef<"CustomerChatDetails", 'String'>
    readonly message: FieldRef<"CustomerChatDetails", 'String'>
    readonly sender: FieldRef<"CustomerChatDetails", 'String'>
    readonly tokenDetails: FieldRef<"CustomerChatDetails", 'Json'>
    readonly createdAt: FieldRef<"CustomerChatDetails", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * CustomerChatDetails findUnique
   */
  export type CustomerChatDetailsFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChatDetails
     */
    select?: CustomerChatDetailsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChatDetails
     */
    omit?: CustomerChatDetailsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatDetailsInclude<ExtArgs> | null
    /**
     * Filter, which CustomerChatDetails to fetch.
     */
    where: CustomerChatDetailsWhereUniqueInput
  }

  /**
   * CustomerChatDetails findUniqueOrThrow
   */
  export type CustomerChatDetailsFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChatDetails
     */
    select?: CustomerChatDetailsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChatDetails
     */
    omit?: CustomerChatDetailsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatDetailsInclude<ExtArgs> | null
    /**
     * Filter, which CustomerChatDetails to fetch.
     */
    where: CustomerChatDetailsWhereUniqueInput
  }

  /**
   * CustomerChatDetails findFirst
   */
  export type CustomerChatDetailsFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChatDetails
     */
    select?: CustomerChatDetailsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChatDetails
     */
    omit?: CustomerChatDetailsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatDetailsInclude<ExtArgs> | null
    /**
     * Filter, which CustomerChatDetails to fetch.
     */
    where?: CustomerChatDetailsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomerChatDetails to fetch.
     */
    orderBy?: CustomerChatDetailsOrderByWithRelationInput | CustomerChatDetailsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CustomerChatDetails.
     */
    cursor?: CustomerChatDetailsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomerChatDetails from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomerChatDetails.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CustomerChatDetails.
     */
    distinct?: CustomerChatDetailsScalarFieldEnum | CustomerChatDetailsScalarFieldEnum[]
  }

  /**
   * CustomerChatDetails findFirstOrThrow
   */
  export type CustomerChatDetailsFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChatDetails
     */
    select?: CustomerChatDetailsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChatDetails
     */
    omit?: CustomerChatDetailsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatDetailsInclude<ExtArgs> | null
    /**
     * Filter, which CustomerChatDetails to fetch.
     */
    where?: CustomerChatDetailsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomerChatDetails to fetch.
     */
    orderBy?: CustomerChatDetailsOrderByWithRelationInput | CustomerChatDetailsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CustomerChatDetails.
     */
    cursor?: CustomerChatDetailsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomerChatDetails from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomerChatDetails.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CustomerChatDetails.
     */
    distinct?: CustomerChatDetailsScalarFieldEnum | CustomerChatDetailsScalarFieldEnum[]
  }

  /**
   * CustomerChatDetails findMany
   */
  export type CustomerChatDetailsFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChatDetails
     */
    select?: CustomerChatDetailsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChatDetails
     */
    omit?: CustomerChatDetailsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatDetailsInclude<ExtArgs> | null
    /**
     * Filter, which CustomerChatDetails to fetch.
     */
    where?: CustomerChatDetailsWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CustomerChatDetails to fetch.
     */
    orderBy?: CustomerChatDetailsOrderByWithRelationInput | CustomerChatDetailsOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing CustomerChatDetails.
     */
    cursor?: CustomerChatDetailsWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CustomerChatDetails from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CustomerChatDetails.
     */
    skip?: number
    distinct?: CustomerChatDetailsScalarFieldEnum | CustomerChatDetailsScalarFieldEnum[]
  }

  /**
   * CustomerChatDetails create
   */
  export type CustomerChatDetailsCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChatDetails
     */
    select?: CustomerChatDetailsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChatDetails
     */
    omit?: CustomerChatDetailsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatDetailsInclude<ExtArgs> | null
    /**
     * The data needed to create a CustomerChatDetails.
     */
    data: XOR<CustomerChatDetailsCreateInput, CustomerChatDetailsUncheckedCreateInput>
  }

  /**
   * CustomerChatDetails createMany
   */
  export type CustomerChatDetailsCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many CustomerChatDetails.
     */
    data: CustomerChatDetailsCreateManyInput | CustomerChatDetailsCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * CustomerChatDetails createManyAndReturn
   */
  export type CustomerChatDetailsCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChatDetails
     */
    select?: CustomerChatDetailsSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChatDetails
     */
    omit?: CustomerChatDetailsOmit<ExtArgs> | null
    /**
     * The data used to create many CustomerChatDetails.
     */
    data: CustomerChatDetailsCreateManyInput | CustomerChatDetailsCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatDetailsIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * CustomerChatDetails update
   */
  export type CustomerChatDetailsUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChatDetails
     */
    select?: CustomerChatDetailsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChatDetails
     */
    omit?: CustomerChatDetailsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatDetailsInclude<ExtArgs> | null
    /**
     * The data needed to update a CustomerChatDetails.
     */
    data: XOR<CustomerChatDetailsUpdateInput, CustomerChatDetailsUncheckedUpdateInput>
    /**
     * Choose, which CustomerChatDetails to update.
     */
    where: CustomerChatDetailsWhereUniqueInput
  }

  /**
   * CustomerChatDetails updateMany
   */
  export type CustomerChatDetailsUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update CustomerChatDetails.
     */
    data: XOR<CustomerChatDetailsUpdateManyMutationInput, CustomerChatDetailsUncheckedUpdateManyInput>
    /**
     * Filter which CustomerChatDetails to update
     */
    where?: CustomerChatDetailsWhereInput
    /**
     * Limit how many CustomerChatDetails to update.
     */
    limit?: number
  }

  /**
   * CustomerChatDetails updateManyAndReturn
   */
  export type CustomerChatDetailsUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChatDetails
     */
    select?: CustomerChatDetailsSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChatDetails
     */
    omit?: CustomerChatDetailsOmit<ExtArgs> | null
    /**
     * The data used to update CustomerChatDetails.
     */
    data: XOR<CustomerChatDetailsUpdateManyMutationInput, CustomerChatDetailsUncheckedUpdateManyInput>
    /**
     * Filter which CustomerChatDetails to update
     */
    where?: CustomerChatDetailsWhereInput
    /**
     * Limit how many CustomerChatDetails to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatDetailsIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * CustomerChatDetails upsert
   */
  export type CustomerChatDetailsUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChatDetails
     */
    select?: CustomerChatDetailsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChatDetails
     */
    omit?: CustomerChatDetailsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatDetailsInclude<ExtArgs> | null
    /**
     * The filter to search for the CustomerChatDetails to update in case it exists.
     */
    where: CustomerChatDetailsWhereUniqueInput
    /**
     * In case the CustomerChatDetails found by the `where` argument doesn't exist, create a new CustomerChatDetails with this data.
     */
    create: XOR<CustomerChatDetailsCreateInput, CustomerChatDetailsUncheckedCreateInput>
    /**
     * In case the CustomerChatDetails was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CustomerChatDetailsUpdateInput, CustomerChatDetailsUncheckedUpdateInput>
  }

  /**
   * CustomerChatDetails delete
   */
  export type CustomerChatDetailsDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChatDetails
     */
    select?: CustomerChatDetailsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChatDetails
     */
    omit?: CustomerChatDetailsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatDetailsInclude<ExtArgs> | null
    /**
     * Filter which CustomerChatDetails to delete.
     */
    where: CustomerChatDetailsWhereUniqueInput
  }

  /**
   * CustomerChatDetails deleteMany
   */
  export type CustomerChatDetailsDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CustomerChatDetails to delete
     */
    where?: CustomerChatDetailsWhereInput
    /**
     * Limit how many CustomerChatDetails to delete.
     */
    limit?: number
  }

  /**
   * CustomerChatDetails without action
   */
  export type CustomerChatDetailsDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerChatDetails
     */
    select?: CustomerChatDetailsSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CustomerChatDetails
     */
    omit?: CustomerChatDetailsOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerChatDetailsInclude<ExtArgs> | null
  }


  /**
   * Model GeoLocation
   */

  export type AggregateGeoLocation = {
    _count: GeoLocationCountAggregateOutputType | null
    _avg: GeoLocationAvgAggregateOutputType | null
    _sum: GeoLocationSumAggregateOutputType | null
    _min: GeoLocationMinAggregateOutputType | null
    _max: GeoLocationMaxAggregateOutputType | null
  }

  export type GeoLocationAvgAggregateOutputType = {
    latitude: number | null
    longitude: number | null
    accuracy: number | null
  }

  export type GeoLocationSumAggregateOutputType = {
    latitude: number | null
    longitude: number | null
    accuracy: number | null
  }

  export type GeoLocationMinAggregateOutputType = {
    id: string | null
    chatId: string | null
    ip: string | null
    country: string | null
    countryCode: string | null
    region: string | null
    city: string | null
    timezone: string | null
    organization: string | null
    organization_name: string | null
    latitude: number | null
    longitude: number | null
    accuracy: number | null
    createdAt: Date | null
  }

  export type GeoLocationMaxAggregateOutputType = {
    id: string | null
    chatId: string | null
    ip: string | null
    country: string | null
    countryCode: string | null
    region: string | null
    city: string | null
    timezone: string | null
    organization: string | null
    organization_name: string | null
    latitude: number | null
    longitude: number | null
    accuracy: number | null
    createdAt: Date | null
  }

  export type GeoLocationCountAggregateOutputType = {
    id: number
    chatId: number
    ip: number
    country: number
    countryCode: number
    region: number
    city: number
    timezone: number
    organization: number
    organization_name: number
    latitude: number
    longitude: number
    accuracy: number
    createdAt: number
    _all: number
  }


  export type GeoLocationAvgAggregateInputType = {
    latitude?: true
    longitude?: true
    accuracy?: true
  }

  export type GeoLocationSumAggregateInputType = {
    latitude?: true
    longitude?: true
    accuracy?: true
  }

  export type GeoLocationMinAggregateInputType = {
    id?: true
    chatId?: true
    ip?: true
    country?: true
    countryCode?: true
    region?: true
    city?: true
    timezone?: true
    organization?: true
    organization_name?: true
    latitude?: true
    longitude?: true
    accuracy?: true
    createdAt?: true
  }

  export type GeoLocationMaxAggregateInputType = {
    id?: true
    chatId?: true
    ip?: true
    country?: true
    countryCode?: true
    region?: true
    city?: true
    timezone?: true
    organization?: true
    organization_name?: true
    latitude?: true
    longitude?: true
    accuracy?: true
    createdAt?: true
  }

  export type GeoLocationCountAggregateInputType = {
    id?: true
    chatId?: true
    ip?: true
    country?: true
    countryCode?: true
    region?: true
    city?: true
    timezone?: true
    organization?: true
    organization_name?: true
    latitude?: true
    longitude?: true
    accuracy?: true
    createdAt?: true
    _all?: true
  }

  export type GeoLocationAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which GeoLocation to aggregate.
     */
    where?: GeoLocationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GeoLocations to fetch.
     */
    orderBy?: GeoLocationOrderByWithRelationInput | GeoLocationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: GeoLocationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GeoLocations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GeoLocations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned GeoLocations
    **/
    _count?: true | GeoLocationCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: GeoLocationAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: GeoLocationSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: GeoLocationMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: GeoLocationMaxAggregateInputType
  }

  export type GetGeoLocationAggregateType<T extends GeoLocationAggregateArgs> = {
        [P in keyof T & keyof AggregateGeoLocation]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateGeoLocation[P]>
      : GetScalarType<T[P], AggregateGeoLocation[P]>
  }




  export type GeoLocationGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: GeoLocationWhereInput
    orderBy?: GeoLocationOrderByWithAggregationInput | GeoLocationOrderByWithAggregationInput[]
    by: GeoLocationScalarFieldEnum[] | GeoLocationScalarFieldEnum
    having?: GeoLocationScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: GeoLocationCountAggregateInputType | true
    _avg?: GeoLocationAvgAggregateInputType
    _sum?: GeoLocationSumAggregateInputType
    _min?: GeoLocationMinAggregateInputType
    _max?: GeoLocationMaxAggregateInputType
  }

  export type GeoLocationGroupByOutputType = {
    id: string
    chatId: string
    ip: string
    country: string
    countryCode: string
    region: string
    city: string
    timezone: string
    organization: string
    organization_name: string
    latitude: number
    longitude: number
    accuracy: number
    createdAt: Date
    _count: GeoLocationCountAggregateOutputType | null
    _avg: GeoLocationAvgAggregateOutputType | null
    _sum: GeoLocationSumAggregateOutputType | null
    _min: GeoLocationMinAggregateOutputType | null
    _max: GeoLocationMaxAggregateOutputType | null
  }

  type GetGeoLocationGroupByPayload<T extends GeoLocationGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<GeoLocationGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof GeoLocationGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], GeoLocationGroupByOutputType[P]>
            : GetScalarType<T[P], GeoLocationGroupByOutputType[P]>
        }
      >
    >


  export type GeoLocationSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    chatId?: boolean
    ip?: boolean
    country?: boolean
    countryCode?: boolean
    region?: boolean
    city?: boolean
    timezone?: boolean
    organization?: boolean
    organization_name?: boolean
    latitude?: boolean
    longitude?: boolean
    accuracy?: boolean
    createdAt?: boolean
    chat?: boolean | CustomerChatsDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["geoLocation"]>

  export type GeoLocationSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    chatId?: boolean
    ip?: boolean
    country?: boolean
    countryCode?: boolean
    region?: boolean
    city?: boolean
    timezone?: boolean
    organization?: boolean
    organization_name?: boolean
    latitude?: boolean
    longitude?: boolean
    accuracy?: boolean
    createdAt?: boolean
    chat?: boolean | CustomerChatsDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["geoLocation"]>

  export type GeoLocationSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    chatId?: boolean
    ip?: boolean
    country?: boolean
    countryCode?: boolean
    region?: boolean
    city?: boolean
    timezone?: boolean
    organization?: boolean
    organization_name?: boolean
    latitude?: boolean
    longitude?: boolean
    accuracy?: boolean
    createdAt?: boolean
    chat?: boolean | CustomerChatsDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["geoLocation"]>

  export type GeoLocationSelectScalar = {
    id?: boolean
    chatId?: boolean
    ip?: boolean
    country?: boolean
    countryCode?: boolean
    region?: boolean
    city?: boolean
    timezone?: boolean
    organization?: boolean
    organization_name?: boolean
    latitude?: boolean
    longitude?: boolean
    accuracy?: boolean
    createdAt?: boolean
  }

  export type GeoLocationOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "chatId" | "ip" | "country" | "countryCode" | "region" | "city" | "timezone" | "organization" | "organization_name" | "latitude" | "longitude" | "accuracy" | "createdAt", ExtArgs["result"]["geoLocation"]>
  export type GeoLocationInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    chat?: boolean | CustomerChatsDefaultArgs<ExtArgs>
  }
  export type GeoLocationIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    chat?: boolean | CustomerChatsDefaultArgs<ExtArgs>
  }
  export type GeoLocationIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    chat?: boolean | CustomerChatsDefaultArgs<ExtArgs>
  }

  export type $GeoLocationPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "GeoLocation"
    objects: {
      chat: Prisma.$CustomerChatsPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      chatId: string
      ip: string
      country: string
      countryCode: string
      region: string
      city: string
      timezone: string
      organization: string
      organization_name: string
      latitude: number
      longitude: number
      accuracy: number
      createdAt: Date
    }, ExtArgs["result"]["geoLocation"]>
    composites: {}
  }

  type GeoLocationGetPayload<S extends boolean | null | undefined | GeoLocationDefaultArgs> = $Result.GetResult<Prisma.$GeoLocationPayload, S>

  type GeoLocationCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<GeoLocationFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: GeoLocationCountAggregateInputType | true
    }

  export interface GeoLocationDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['GeoLocation'], meta: { name: 'GeoLocation' } }
    /**
     * Find zero or one GeoLocation that matches the filter.
     * @param {GeoLocationFindUniqueArgs} args - Arguments to find a GeoLocation
     * @example
     * // Get one GeoLocation
     * const geoLocation = await prisma.geoLocation.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends GeoLocationFindUniqueArgs>(args: SelectSubset<T, GeoLocationFindUniqueArgs<ExtArgs>>): Prisma__GeoLocationClient<$Result.GetResult<Prisma.$GeoLocationPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one GeoLocation that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {GeoLocationFindUniqueOrThrowArgs} args - Arguments to find a GeoLocation
     * @example
     * // Get one GeoLocation
     * const geoLocation = await prisma.geoLocation.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends GeoLocationFindUniqueOrThrowArgs>(args: SelectSubset<T, GeoLocationFindUniqueOrThrowArgs<ExtArgs>>): Prisma__GeoLocationClient<$Result.GetResult<Prisma.$GeoLocationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first GeoLocation that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GeoLocationFindFirstArgs} args - Arguments to find a GeoLocation
     * @example
     * // Get one GeoLocation
     * const geoLocation = await prisma.geoLocation.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends GeoLocationFindFirstArgs>(args?: SelectSubset<T, GeoLocationFindFirstArgs<ExtArgs>>): Prisma__GeoLocationClient<$Result.GetResult<Prisma.$GeoLocationPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first GeoLocation that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GeoLocationFindFirstOrThrowArgs} args - Arguments to find a GeoLocation
     * @example
     * // Get one GeoLocation
     * const geoLocation = await prisma.geoLocation.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends GeoLocationFindFirstOrThrowArgs>(args?: SelectSubset<T, GeoLocationFindFirstOrThrowArgs<ExtArgs>>): Prisma__GeoLocationClient<$Result.GetResult<Prisma.$GeoLocationPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more GeoLocations that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GeoLocationFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all GeoLocations
     * const geoLocations = await prisma.geoLocation.findMany()
     * 
     * // Get first 10 GeoLocations
     * const geoLocations = await prisma.geoLocation.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const geoLocationWithIdOnly = await prisma.geoLocation.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends GeoLocationFindManyArgs>(args?: SelectSubset<T, GeoLocationFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GeoLocationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a GeoLocation.
     * @param {GeoLocationCreateArgs} args - Arguments to create a GeoLocation.
     * @example
     * // Create one GeoLocation
     * const GeoLocation = await prisma.geoLocation.create({
     *   data: {
     *     // ... data to create a GeoLocation
     *   }
     * })
     * 
     */
    create<T extends GeoLocationCreateArgs>(args: SelectSubset<T, GeoLocationCreateArgs<ExtArgs>>): Prisma__GeoLocationClient<$Result.GetResult<Prisma.$GeoLocationPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many GeoLocations.
     * @param {GeoLocationCreateManyArgs} args - Arguments to create many GeoLocations.
     * @example
     * // Create many GeoLocations
     * const geoLocation = await prisma.geoLocation.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends GeoLocationCreateManyArgs>(args?: SelectSubset<T, GeoLocationCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many GeoLocations and returns the data saved in the database.
     * @param {GeoLocationCreateManyAndReturnArgs} args - Arguments to create many GeoLocations.
     * @example
     * // Create many GeoLocations
     * const geoLocation = await prisma.geoLocation.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many GeoLocations and only return the `id`
     * const geoLocationWithIdOnly = await prisma.geoLocation.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends GeoLocationCreateManyAndReturnArgs>(args?: SelectSubset<T, GeoLocationCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GeoLocationPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a GeoLocation.
     * @param {GeoLocationDeleteArgs} args - Arguments to delete one GeoLocation.
     * @example
     * // Delete one GeoLocation
     * const GeoLocation = await prisma.geoLocation.delete({
     *   where: {
     *     // ... filter to delete one GeoLocation
     *   }
     * })
     * 
     */
    delete<T extends GeoLocationDeleteArgs>(args: SelectSubset<T, GeoLocationDeleteArgs<ExtArgs>>): Prisma__GeoLocationClient<$Result.GetResult<Prisma.$GeoLocationPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one GeoLocation.
     * @param {GeoLocationUpdateArgs} args - Arguments to update one GeoLocation.
     * @example
     * // Update one GeoLocation
     * const geoLocation = await prisma.geoLocation.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends GeoLocationUpdateArgs>(args: SelectSubset<T, GeoLocationUpdateArgs<ExtArgs>>): Prisma__GeoLocationClient<$Result.GetResult<Prisma.$GeoLocationPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more GeoLocations.
     * @param {GeoLocationDeleteManyArgs} args - Arguments to filter GeoLocations to delete.
     * @example
     * // Delete a few GeoLocations
     * const { count } = await prisma.geoLocation.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends GeoLocationDeleteManyArgs>(args?: SelectSubset<T, GeoLocationDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more GeoLocations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GeoLocationUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many GeoLocations
     * const geoLocation = await prisma.geoLocation.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends GeoLocationUpdateManyArgs>(args: SelectSubset<T, GeoLocationUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more GeoLocations and returns the data updated in the database.
     * @param {GeoLocationUpdateManyAndReturnArgs} args - Arguments to update many GeoLocations.
     * @example
     * // Update many GeoLocations
     * const geoLocation = await prisma.geoLocation.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more GeoLocations and only return the `id`
     * const geoLocationWithIdOnly = await prisma.geoLocation.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends GeoLocationUpdateManyAndReturnArgs>(args: SelectSubset<T, GeoLocationUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GeoLocationPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one GeoLocation.
     * @param {GeoLocationUpsertArgs} args - Arguments to update or create a GeoLocation.
     * @example
     * // Update or create a GeoLocation
     * const geoLocation = await prisma.geoLocation.upsert({
     *   create: {
     *     // ... data to create a GeoLocation
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the GeoLocation we want to update
     *   }
     * })
     */
    upsert<T extends GeoLocationUpsertArgs>(args: SelectSubset<T, GeoLocationUpsertArgs<ExtArgs>>): Prisma__GeoLocationClient<$Result.GetResult<Prisma.$GeoLocationPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of GeoLocations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GeoLocationCountArgs} args - Arguments to filter GeoLocations to count.
     * @example
     * // Count the number of GeoLocations
     * const count = await prisma.geoLocation.count({
     *   where: {
     *     // ... the filter for the GeoLocations we want to count
     *   }
     * })
    **/
    count<T extends GeoLocationCountArgs>(
      args?: Subset<T, GeoLocationCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], GeoLocationCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a GeoLocation.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GeoLocationAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends GeoLocationAggregateArgs>(args: Subset<T, GeoLocationAggregateArgs>): Prisma.PrismaPromise<GetGeoLocationAggregateType<T>>

    /**
     * Group by GeoLocation.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GeoLocationGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends GeoLocationGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: GeoLocationGroupByArgs['orderBy'] }
        : { orderBy?: GeoLocationGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, GeoLocationGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetGeoLocationGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the GeoLocation model
   */
  readonly fields: GeoLocationFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for GeoLocation.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__GeoLocationClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    chat<T extends CustomerChatsDefaultArgs<ExtArgs> = {}>(args?: Subset<T, CustomerChatsDefaultArgs<ExtArgs>>): Prisma__CustomerChatsClient<$Result.GetResult<Prisma.$CustomerChatsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the GeoLocation model
   */
  interface GeoLocationFieldRefs {
    readonly id: FieldRef<"GeoLocation", 'String'>
    readonly chatId: FieldRef<"GeoLocation", 'String'>
    readonly ip: FieldRef<"GeoLocation", 'String'>
    readonly country: FieldRef<"GeoLocation", 'String'>
    readonly countryCode: FieldRef<"GeoLocation", 'String'>
    readonly region: FieldRef<"GeoLocation", 'String'>
    readonly city: FieldRef<"GeoLocation", 'String'>
    readonly timezone: FieldRef<"GeoLocation", 'String'>
    readonly organization: FieldRef<"GeoLocation", 'String'>
    readonly organization_name: FieldRef<"GeoLocation", 'String'>
    readonly latitude: FieldRef<"GeoLocation", 'Float'>
    readonly longitude: FieldRef<"GeoLocation", 'Float'>
    readonly accuracy: FieldRef<"GeoLocation", 'Int'>
    readonly createdAt: FieldRef<"GeoLocation", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * GeoLocation findUnique
   */
  export type GeoLocationFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GeoLocation
     */
    select?: GeoLocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GeoLocation
     */
    omit?: GeoLocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GeoLocationInclude<ExtArgs> | null
    /**
     * Filter, which GeoLocation to fetch.
     */
    where: GeoLocationWhereUniqueInput
  }

  /**
   * GeoLocation findUniqueOrThrow
   */
  export type GeoLocationFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GeoLocation
     */
    select?: GeoLocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GeoLocation
     */
    omit?: GeoLocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GeoLocationInclude<ExtArgs> | null
    /**
     * Filter, which GeoLocation to fetch.
     */
    where: GeoLocationWhereUniqueInput
  }

  /**
   * GeoLocation findFirst
   */
  export type GeoLocationFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GeoLocation
     */
    select?: GeoLocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GeoLocation
     */
    omit?: GeoLocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GeoLocationInclude<ExtArgs> | null
    /**
     * Filter, which GeoLocation to fetch.
     */
    where?: GeoLocationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GeoLocations to fetch.
     */
    orderBy?: GeoLocationOrderByWithRelationInput | GeoLocationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for GeoLocations.
     */
    cursor?: GeoLocationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GeoLocations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GeoLocations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of GeoLocations.
     */
    distinct?: GeoLocationScalarFieldEnum | GeoLocationScalarFieldEnum[]
  }

  /**
   * GeoLocation findFirstOrThrow
   */
  export type GeoLocationFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GeoLocation
     */
    select?: GeoLocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GeoLocation
     */
    omit?: GeoLocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GeoLocationInclude<ExtArgs> | null
    /**
     * Filter, which GeoLocation to fetch.
     */
    where?: GeoLocationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GeoLocations to fetch.
     */
    orderBy?: GeoLocationOrderByWithRelationInput | GeoLocationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for GeoLocations.
     */
    cursor?: GeoLocationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GeoLocations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GeoLocations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of GeoLocations.
     */
    distinct?: GeoLocationScalarFieldEnum | GeoLocationScalarFieldEnum[]
  }

  /**
   * GeoLocation findMany
   */
  export type GeoLocationFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GeoLocation
     */
    select?: GeoLocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GeoLocation
     */
    omit?: GeoLocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GeoLocationInclude<ExtArgs> | null
    /**
     * Filter, which GeoLocations to fetch.
     */
    where?: GeoLocationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GeoLocations to fetch.
     */
    orderBy?: GeoLocationOrderByWithRelationInput | GeoLocationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing GeoLocations.
     */
    cursor?: GeoLocationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GeoLocations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GeoLocations.
     */
    skip?: number
    distinct?: GeoLocationScalarFieldEnum | GeoLocationScalarFieldEnum[]
  }

  /**
   * GeoLocation create
   */
  export type GeoLocationCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GeoLocation
     */
    select?: GeoLocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GeoLocation
     */
    omit?: GeoLocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GeoLocationInclude<ExtArgs> | null
    /**
     * The data needed to create a GeoLocation.
     */
    data: XOR<GeoLocationCreateInput, GeoLocationUncheckedCreateInput>
  }

  /**
   * GeoLocation createMany
   */
  export type GeoLocationCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many GeoLocations.
     */
    data: GeoLocationCreateManyInput | GeoLocationCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * GeoLocation createManyAndReturn
   */
  export type GeoLocationCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GeoLocation
     */
    select?: GeoLocationSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the GeoLocation
     */
    omit?: GeoLocationOmit<ExtArgs> | null
    /**
     * The data used to create many GeoLocations.
     */
    data: GeoLocationCreateManyInput | GeoLocationCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GeoLocationIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * GeoLocation update
   */
  export type GeoLocationUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GeoLocation
     */
    select?: GeoLocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GeoLocation
     */
    omit?: GeoLocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GeoLocationInclude<ExtArgs> | null
    /**
     * The data needed to update a GeoLocation.
     */
    data: XOR<GeoLocationUpdateInput, GeoLocationUncheckedUpdateInput>
    /**
     * Choose, which GeoLocation to update.
     */
    where: GeoLocationWhereUniqueInput
  }

  /**
   * GeoLocation updateMany
   */
  export type GeoLocationUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update GeoLocations.
     */
    data: XOR<GeoLocationUpdateManyMutationInput, GeoLocationUncheckedUpdateManyInput>
    /**
     * Filter which GeoLocations to update
     */
    where?: GeoLocationWhereInput
    /**
     * Limit how many GeoLocations to update.
     */
    limit?: number
  }

  /**
   * GeoLocation updateManyAndReturn
   */
  export type GeoLocationUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GeoLocation
     */
    select?: GeoLocationSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the GeoLocation
     */
    omit?: GeoLocationOmit<ExtArgs> | null
    /**
     * The data used to update GeoLocations.
     */
    data: XOR<GeoLocationUpdateManyMutationInput, GeoLocationUncheckedUpdateManyInput>
    /**
     * Filter which GeoLocations to update
     */
    where?: GeoLocationWhereInput
    /**
     * Limit how many GeoLocations to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GeoLocationIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * GeoLocation upsert
   */
  export type GeoLocationUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GeoLocation
     */
    select?: GeoLocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GeoLocation
     */
    omit?: GeoLocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GeoLocationInclude<ExtArgs> | null
    /**
     * The filter to search for the GeoLocation to update in case it exists.
     */
    where: GeoLocationWhereUniqueInput
    /**
     * In case the GeoLocation found by the `where` argument doesn't exist, create a new GeoLocation with this data.
     */
    create: XOR<GeoLocationCreateInput, GeoLocationUncheckedCreateInput>
    /**
     * In case the GeoLocation was found with the provided `where` argument, update it with this data.
     */
    update: XOR<GeoLocationUpdateInput, GeoLocationUncheckedUpdateInput>
  }

  /**
   * GeoLocation delete
   */
  export type GeoLocationDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GeoLocation
     */
    select?: GeoLocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GeoLocation
     */
    omit?: GeoLocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GeoLocationInclude<ExtArgs> | null
    /**
     * Filter which GeoLocation to delete.
     */
    where: GeoLocationWhereUniqueInput
  }

  /**
   * GeoLocation deleteMany
   */
  export type GeoLocationDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which GeoLocations to delete
     */
    where?: GeoLocationWhereInput
    /**
     * Limit how many GeoLocations to delete.
     */
    limit?: number
  }

  /**
   * GeoLocation without action
   */
  export type GeoLocationDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GeoLocation
     */
    select?: GeoLocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GeoLocation
     */
    omit?: GeoLocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GeoLocationInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const UserScalarFieldEnum: {
    id: 'id',
    name: 'name',
    email: 'email',
    phonenumber: 'phonenumber',
    password: 'password',
    refreshToken: 'refreshToken',
    emailVerified: 'emailVerified',
    phoneVerified: 'phoneVerified',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const QuotaScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    quotaType: 'quotaType',
    limit: 'limit',
    used: 'used'
  };

  export type QuotaScalarFieldEnum = (typeof QuotaScalarFieldEnum)[keyof typeof QuotaScalarFieldEnum]


  export const StorageScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    botId: 'botId',
    fileName: 'fileName',
    fileUrl: 'fileUrl',
    type: 'type',
    size: 'size',
    status: 'status',
    taskId: 'taskId',
    ingestionInfo: 'ingestionInfo',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    deletedAt: 'deletedAt',
    isDeleted: 'isDeleted'
  };

  export type StorageScalarFieldEnum = (typeof StorageScalarFieldEnum)[keyof typeof StorageScalarFieldEnum]


  export const ContentScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    botId: 'botId',
    content: 'content',
    type: 'type',
    status: 'status',
    taskId: 'taskId',
    ingestionInfo: 'ingestionInfo',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    deletedAt: 'deletedAt',
    isDeleted: 'isDeleted'
  };

  export type ContentScalarFieldEnum = (typeof ContentScalarFieldEnum)[keyof typeof ContentScalarFieldEnum]


  export const CustomerBotsScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    botName: 'botName',
    botAvatar: 'botAvatar',
    systemPrompt: 'systemPrompt',
    settings: 'settings',
    active: 'active',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    isDeleted: 'isDeleted',
    deletedAt: 'deletedAt'
  };

  export type CustomerBotsScalarFieldEnum = (typeof CustomerBotsScalarFieldEnum)[keyof typeof CustomerBotsScalarFieldEnum]


  export const CustomerChatsScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    botId: 'botId',
    chatId: 'chatId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    isDeleted: 'isDeleted',
    deletedAt: 'deletedAt',
    totalTokens: 'totalTokens'
  };

  export type CustomerChatsScalarFieldEnum = (typeof CustomerChatsScalarFieldEnum)[keyof typeof CustomerChatsScalarFieldEnum]


  export const CustomerChatDetailsScalarFieldEnum: {
    id: 'id',
    chatId: 'chatId',
    message: 'message',
    sender: 'sender',
    tokenDetails: 'tokenDetails',
    createdAt: 'createdAt'
  };

  export type CustomerChatDetailsScalarFieldEnum = (typeof CustomerChatDetailsScalarFieldEnum)[keyof typeof CustomerChatDetailsScalarFieldEnum]


  export const GeoLocationScalarFieldEnum: {
    id: 'id',
    chatId: 'chatId',
    ip: 'ip',
    country: 'country',
    countryCode: 'countryCode',
    region: 'region',
    city: 'city',
    timezone: 'timezone',
    organization: 'organization',
    organization_name: 'organization_name',
    latitude: 'latitude',
    longitude: 'longitude',
    accuracy: 'accuracy',
    createdAt: 'createdAt'
  };

  export type GeoLocationScalarFieldEnum = (typeof GeoLocationScalarFieldEnum)[keyof typeof GeoLocationScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'QuotaType'
   */
  export type EnumQuotaTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QuotaType'>
    


  /**
   * Reference to a field of type 'QuotaType[]'
   */
  export type ListEnumQuotaTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QuotaType[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: StringFilter<"User"> | string
    name?: StringFilter<"User"> | string
    email?: StringFilter<"User"> | string
    phonenumber?: StringNullableFilter<"User"> | string | null
    password?: StringFilter<"User"> | string
    refreshToken?: StringNullableFilter<"User"> | string | null
    emailVerified?: BoolFilter<"User"> | boolean
    phoneVerified?: BoolFilter<"User"> | boolean
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    Storage?: StorageListRelationFilter
    CustomerBots?: CustomerBotsListRelationFilter
    Quota?: QuotaListRelationFilter
    CustomerChats?: CustomerChatsListRelationFilter
    Content?: ContentListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    phonenumber?: SortOrderInput | SortOrder
    password?: SortOrder
    refreshToken?: SortOrderInput | SortOrder
    emailVerified?: SortOrder
    phoneVerified?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    Storage?: StorageOrderByRelationAggregateInput
    CustomerBots?: CustomerBotsOrderByRelationAggregateInput
    Quota?: QuotaOrderByRelationAggregateInput
    CustomerChats?: CustomerChatsOrderByRelationAggregateInput
    Content?: ContentOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    phonenumber?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    name?: StringFilter<"User"> | string
    password?: StringFilter<"User"> | string
    refreshToken?: StringNullableFilter<"User"> | string | null
    emailVerified?: BoolFilter<"User"> | boolean
    phoneVerified?: BoolFilter<"User"> | boolean
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    Storage?: StorageListRelationFilter
    CustomerBots?: CustomerBotsListRelationFilter
    Quota?: QuotaListRelationFilter
    CustomerChats?: CustomerChatsListRelationFilter
    Content?: ContentListRelationFilter
  }, "id" | "email" | "phonenumber">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    phonenumber?: SortOrderInput | SortOrder
    password?: SortOrder
    refreshToken?: SortOrderInput | SortOrder
    emailVerified?: SortOrder
    phoneVerified?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"User"> | string
    name?: StringWithAggregatesFilter<"User"> | string
    email?: StringWithAggregatesFilter<"User"> | string
    phonenumber?: StringNullableWithAggregatesFilter<"User"> | string | null
    password?: StringWithAggregatesFilter<"User"> | string
    refreshToken?: StringNullableWithAggregatesFilter<"User"> | string | null
    emailVerified?: BoolWithAggregatesFilter<"User"> | boolean
    phoneVerified?: BoolWithAggregatesFilter<"User"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
  }

  export type QuotaWhereInput = {
    AND?: QuotaWhereInput | QuotaWhereInput[]
    OR?: QuotaWhereInput[]
    NOT?: QuotaWhereInput | QuotaWhereInput[]
    id?: StringFilter<"Quota"> | string
    userId?: StringFilter<"Quota"> | string
    quotaType?: EnumQuotaTypeNullableFilter<"Quota"> | $Enums.QuotaType | null
    limit?: IntFilter<"Quota"> | number
    used?: IntFilter<"Quota"> | number
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type QuotaOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    quotaType?: SortOrderInput | SortOrder
    limit?: SortOrder
    used?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type QuotaWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    userId_quotaType?: QuotaUserIdQuotaTypeCompoundUniqueInput
    AND?: QuotaWhereInput | QuotaWhereInput[]
    OR?: QuotaWhereInput[]
    NOT?: QuotaWhereInput | QuotaWhereInput[]
    userId?: StringFilter<"Quota"> | string
    quotaType?: EnumQuotaTypeNullableFilter<"Quota"> | $Enums.QuotaType | null
    limit?: IntFilter<"Quota"> | number
    used?: IntFilter<"Quota"> | number
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id" | "userId_quotaType">

  export type QuotaOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    quotaType?: SortOrderInput | SortOrder
    limit?: SortOrder
    used?: SortOrder
    _count?: QuotaCountOrderByAggregateInput
    _avg?: QuotaAvgOrderByAggregateInput
    _max?: QuotaMaxOrderByAggregateInput
    _min?: QuotaMinOrderByAggregateInput
    _sum?: QuotaSumOrderByAggregateInput
  }

  export type QuotaScalarWhereWithAggregatesInput = {
    AND?: QuotaScalarWhereWithAggregatesInput | QuotaScalarWhereWithAggregatesInput[]
    OR?: QuotaScalarWhereWithAggregatesInput[]
    NOT?: QuotaScalarWhereWithAggregatesInput | QuotaScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Quota"> | string
    userId?: StringWithAggregatesFilter<"Quota"> | string
    quotaType?: EnumQuotaTypeNullableWithAggregatesFilter<"Quota"> | $Enums.QuotaType | null
    limit?: IntWithAggregatesFilter<"Quota"> | number
    used?: IntWithAggregatesFilter<"Quota"> | number
  }

  export type StorageWhereInput = {
    AND?: StorageWhereInput | StorageWhereInput[]
    OR?: StorageWhereInput[]
    NOT?: StorageWhereInput | StorageWhereInput[]
    id?: StringFilter<"Storage"> | string
    userId?: StringFilter<"Storage"> | string
    botId?: StringFilter<"Storage"> | string
    fileName?: StringFilter<"Storage"> | string
    fileUrl?: StringFilter<"Storage"> | string
    type?: StringFilter<"Storage"> | string
    size?: StringFilter<"Storage"> | string
    status?: StringFilter<"Storage"> | string
    taskId?: StringFilter<"Storage"> | string
    ingestionInfo?: JsonNullableFilter<"Storage">
    createdAt?: DateTimeFilter<"Storage"> | Date | string
    updatedAt?: DateTimeFilter<"Storage"> | Date | string
    deletedAt?: DateTimeNullableFilter<"Storage"> | Date | string | null
    isDeleted?: BoolFilter<"Storage"> | boolean
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type StorageOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    botId?: SortOrder
    fileName?: SortOrder
    fileUrl?: SortOrder
    type?: SortOrder
    size?: SortOrder
    status?: SortOrder
    taskId?: SortOrder
    ingestionInfo?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    isDeleted?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type StorageWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: StorageWhereInput | StorageWhereInput[]
    OR?: StorageWhereInput[]
    NOT?: StorageWhereInput | StorageWhereInput[]
    userId?: StringFilter<"Storage"> | string
    botId?: StringFilter<"Storage"> | string
    fileName?: StringFilter<"Storage"> | string
    fileUrl?: StringFilter<"Storage"> | string
    type?: StringFilter<"Storage"> | string
    size?: StringFilter<"Storage"> | string
    status?: StringFilter<"Storage"> | string
    taskId?: StringFilter<"Storage"> | string
    ingestionInfo?: JsonNullableFilter<"Storage">
    createdAt?: DateTimeFilter<"Storage"> | Date | string
    updatedAt?: DateTimeFilter<"Storage"> | Date | string
    deletedAt?: DateTimeNullableFilter<"Storage"> | Date | string | null
    isDeleted?: BoolFilter<"Storage"> | boolean
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id">

  export type StorageOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    botId?: SortOrder
    fileName?: SortOrder
    fileUrl?: SortOrder
    type?: SortOrder
    size?: SortOrder
    status?: SortOrder
    taskId?: SortOrder
    ingestionInfo?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    isDeleted?: SortOrder
    _count?: StorageCountOrderByAggregateInput
    _max?: StorageMaxOrderByAggregateInput
    _min?: StorageMinOrderByAggregateInput
  }

  export type StorageScalarWhereWithAggregatesInput = {
    AND?: StorageScalarWhereWithAggregatesInput | StorageScalarWhereWithAggregatesInput[]
    OR?: StorageScalarWhereWithAggregatesInput[]
    NOT?: StorageScalarWhereWithAggregatesInput | StorageScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Storage"> | string
    userId?: StringWithAggregatesFilter<"Storage"> | string
    botId?: StringWithAggregatesFilter<"Storage"> | string
    fileName?: StringWithAggregatesFilter<"Storage"> | string
    fileUrl?: StringWithAggregatesFilter<"Storage"> | string
    type?: StringWithAggregatesFilter<"Storage"> | string
    size?: StringWithAggregatesFilter<"Storage"> | string
    status?: StringWithAggregatesFilter<"Storage"> | string
    taskId?: StringWithAggregatesFilter<"Storage"> | string
    ingestionInfo?: JsonNullableWithAggregatesFilter<"Storage">
    createdAt?: DateTimeWithAggregatesFilter<"Storage"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Storage"> | Date | string
    deletedAt?: DateTimeNullableWithAggregatesFilter<"Storage"> | Date | string | null
    isDeleted?: BoolWithAggregatesFilter<"Storage"> | boolean
  }

  export type ContentWhereInput = {
    AND?: ContentWhereInput | ContentWhereInput[]
    OR?: ContentWhereInput[]
    NOT?: ContentWhereInput | ContentWhereInput[]
    id?: StringFilter<"Content"> | string
    userId?: StringFilter<"Content"> | string
    botId?: StringFilter<"Content"> | string
    content?: JsonNullableFilter<"Content">
    type?: StringFilter<"Content"> | string
    status?: StringFilter<"Content"> | string
    taskId?: StringFilter<"Content"> | string
    ingestionInfo?: JsonNullableFilter<"Content">
    createdAt?: DateTimeFilter<"Content"> | Date | string
    updatedAt?: DateTimeFilter<"Content"> | Date | string
    deletedAt?: DateTimeNullableFilter<"Content"> | Date | string | null
    isDeleted?: BoolFilter<"Content"> | boolean
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type ContentOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    botId?: SortOrder
    content?: SortOrderInput | SortOrder
    type?: SortOrder
    status?: SortOrder
    taskId?: SortOrder
    ingestionInfo?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    isDeleted?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type ContentWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ContentWhereInput | ContentWhereInput[]
    OR?: ContentWhereInput[]
    NOT?: ContentWhereInput | ContentWhereInput[]
    userId?: StringFilter<"Content"> | string
    botId?: StringFilter<"Content"> | string
    content?: JsonNullableFilter<"Content">
    type?: StringFilter<"Content"> | string
    status?: StringFilter<"Content"> | string
    taskId?: StringFilter<"Content"> | string
    ingestionInfo?: JsonNullableFilter<"Content">
    createdAt?: DateTimeFilter<"Content"> | Date | string
    updatedAt?: DateTimeFilter<"Content"> | Date | string
    deletedAt?: DateTimeNullableFilter<"Content"> | Date | string | null
    isDeleted?: BoolFilter<"Content"> | boolean
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id">

  export type ContentOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    botId?: SortOrder
    content?: SortOrderInput | SortOrder
    type?: SortOrder
    status?: SortOrder
    taskId?: SortOrder
    ingestionInfo?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    isDeleted?: SortOrder
    _count?: ContentCountOrderByAggregateInput
    _max?: ContentMaxOrderByAggregateInput
    _min?: ContentMinOrderByAggregateInput
  }

  export type ContentScalarWhereWithAggregatesInput = {
    AND?: ContentScalarWhereWithAggregatesInput | ContentScalarWhereWithAggregatesInput[]
    OR?: ContentScalarWhereWithAggregatesInput[]
    NOT?: ContentScalarWhereWithAggregatesInput | ContentScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Content"> | string
    userId?: StringWithAggregatesFilter<"Content"> | string
    botId?: StringWithAggregatesFilter<"Content"> | string
    content?: JsonNullableWithAggregatesFilter<"Content">
    type?: StringWithAggregatesFilter<"Content"> | string
    status?: StringWithAggregatesFilter<"Content"> | string
    taskId?: StringWithAggregatesFilter<"Content"> | string
    ingestionInfo?: JsonNullableWithAggregatesFilter<"Content">
    createdAt?: DateTimeWithAggregatesFilter<"Content"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Content"> | Date | string
    deletedAt?: DateTimeNullableWithAggregatesFilter<"Content"> | Date | string | null
    isDeleted?: BoolWithAggregatesFilter<"Content"> | boolean
  }

  export type CustomerBotsWhereInput = {
    AND?: CustomerBotsWhereInput | CustomerBotsWhereInput[]
    OR?: CustomerBotsWhereInput[]
    NOT?: CustomerBotsWhereInput | CustomerBotsWhereInput[]
    id?: StringFilter<"CustomerBots"> | string
    userId?: StringFilter<"CustomerBots"> | string
    botName?: StringFilter<"CustomerBots"> | string
    botAvatar?: StringFilter<"CustomerBots"> | string
    systemPrompt?: StringFilter<"CustomerBots"> | string
    settings?: JsonNullableFilter<"CustomerBots">
    active?: BoolFilter<"CustomerBots"> | boolean
    createdAt?: DateTimeFilter<"CustomerBots"> | Date | string
    updatedAt?: DateTimeFilter<"CustomerBots"> | Date | string
    isDeleted?: BoolFilter<"CustomerBots"> | boolean
    deletedAt?: DateTimeNullableFilter<"CustomerBots"> | Date | string | null
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type CustomerBotsOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    botName?: SortOrder
    botAvatar?: SortOrder
    systemPrompt?: SortOrder
    settings?: SortOrderInput | SortOrder
    active?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type CustomerBotsWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: CustomerBotsWhereInput | CustomerBotsWhereInput[]
    OR?: CustomerBotsWhereInput[]
    NOT?: CustomerBotsWhereInput | CustomerBotsWhereInput[]
    userId?: StringFilter<"CustomerBots"> | string
    botName?: StringFilter<"CustomerBots"> | string
    botAvatar?: StringFilter<"CustomerBots"> | string
    systemPrompt?: StringFilter<"CustomerBots"> | string
    settings?: JsonNullableFilter<"CustomerBots">
    active?: BoolFilter<"CustomerBots"> | boolean
    createdAt?: DateTimeFilter<"CustomerBots"> | Date | string
    updatedAt?: DateTimeFilter<"CustomerBots"> | Date | string
    isDeleted?: BoolFilter<"CustomerBots"> | boolean
    deletedAt?: DateTimeNullableFilter<"CustomerBots"> | Date | string | null
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id">

  export type CustomerBotsOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    botName?: SortOrder
    botAvatar?: SortOrder
    systemPrompt?: SortOrder
    settings?: SortOrderInput | SortOrder
    active?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    _count?: CustomerBotsCountOrderByAggregateInput
    _max?: CustomerBotsMaxOrderByAggregateInput
    _min?: CustomerBotsMinOrderByAggregateInput
  }

  export type CustomerBotsScalarWhereWithAggregatesInput = {
    AND?: CustomerBotsScalarWhereWithAggregatesInput | CustomerBotsScalarWhereWithAggregatesInput[]
    OR?: CustomerBotsScalarWhereWithAggregatesInput[]
    NOT?: CustomerBotsScalarWhereWithAggregatesInput | CustomerBotsScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"CustomerBots"> | string
    userId?: StringWithAggregatesFilter<"CustomerBots"> | string
    botName?: StringWithAggregatesFilter<"CustomerBots"> | string
    botAvatar?: StringWithAggregatesFilter<"CustomerBots"> | string
    systemPrompt?: StringWithAggregatesFilter<"CustomerBots"> | string
    settings?: JsonNullableWithAggregatesFilter<"CustomerBots">
    active?: BoolWithAggregatesFilter<"CustomerBots"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"CustomerBots"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"CustomerBots"> | Date | string
    isDeleted?: BoolWithAggregatesFilter<"CustomerBots"> | boolean
    deletedAt?: DateTimeNullableWithAggregatesFilter<"CustomerBots"> | Date | string | null
  }

  export type CustomerChatsWhereInput = {
    AND?: CustomerChatsWhereInput | CustomerChatsWhereInput[]
    OR?: CustomerChatsWhereInput[]
    NOT?: CustomerChatsWhereInput | CustomerChatsWhereInput[]
    id?: StringFilter<"CustomerChats"> | string
    userId?: StringFilter<"CustomerChats"> | string
    botId?: StringFilter<"CustomerChats"> | string
    chatId?: StringFilter<"CustomerChats"> | string
    createdAt?: DateTimeFilter<"CustomerChats"> | Date | string
    updatedAt?: DateTimeFilter<"CustomerChats"> | Date | string
    isDeleted?: BoolFilter<"CustomerChats"> | boolean
    deletedAt?: DateTimeNullableFilter<"CustomerChats"> | Date | string | null
    totalTokens?: IntNullableFilter<"CustomerChats"> | number | null
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    CustomerChatDetails?: CustomerChatDetailsListRelationFilter
    GeoLocation?: GeoLocationListRelationFilter
  }

  export type CustomerChatsOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    botId?: SortOrder
    chatId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    totalTokens?: SortOrderInput | SortOrder
    user?: UserOrderByWithRelationInput
    CustomerChatDetails?: CustomerChatDetailsOrderByRelationAggregateInput
    GeoLocation?: GeoLocationOrderByRelationAggregateInput
  }

  export type CustomerChatsWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: CustomerChatsWhereInput | CustomerChatsWhereInput[]
    OR?: CustomerChatsWhereInput[]
    NOT?: CustomerChatsWhereInput | CustomerChatsWhereInput[]
    userId?: StringFilter<"CustomerChats"> | string
    botId?: StringFilter<"CustomerChats"> | string
    chatId?: StringFilter<"CustomerChats"> | string
    createdAt?: DateTimeFilter<"CustomerChats"> | Date | string
    updatedAt?: DateTimeFilter<"CustomerChats"> | Date | string
    isDeleted?: BoolFilter<"CustomerChats"> | boolean
    deletedAt?: DateTimeNullableFilter<"CustomerChats"> | Date | string | null
    totalTokens?: IntNullableFilter<"CustomerChats"> | number | null
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    CustomerChatDetails?: CustomerChatDetailsListRelationFilter
    GeoLocation?: GeoLocationListRelationFilter
  }, "id">

  export type CustomerChatsOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    botId?: SortOrder
    chatId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    totalTokens?: SortOrderInput | SortOrder
    _count?: CustomerChatsCountOrderByAggregateInput
    _avg?: CustomerChatsAvgOrderByAggregateInput
    _max?: CustomerChatsMaxOrderByAggregateInput
    _min?: CustomerChatsMinOrderByAggregateInput
    _sum?: CustomerChatsSumOrderByAggregateInput
  }

  export type CustomerChatsScalarWhereWithAggregatesInput = {
    AND?: CustomerChatsScalarWhereWithAggregatesInput | CustomerChatsScalarWhereWithAggregatesInput[]
    OR?: CustomerChatsScalarWhereWithAggregatesInput[]
    NOT?: CustomerChatsScalarWhereWithAggregatesInput | CustomerChatsScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"CustomerChats"> | string
    userId?: StringWithAggregatesFilter<"CustomerChats"> | string
    botId?: StringWithAggregatesFilter<"CustomerChats"> | string
    chatId?: StringWithAggregatesFilter<"CustomerChats"> | string
    createdAt?: DateTimeWithAggregatesFilter<"CustomerChats"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"CustomerChats"> | Date | string
    isDeleted?: BoolWithAggregatesFilter<"CustomerChats"> | boolean
    deletedAt?: DateTimeNullableWithAggregatesFilter<"CustomerChats"> | Date | string | null
    totalTokens?: IntNullableWithAggregatesFilter<"CustomerChats"> | number | null
  }

  export type CustomerChatDetailsWhereInput = {
    AND?: CustomerChatDetailsWhereInput | CustomerChatDetailsWhereInput[]
    OR?: CustomerChatDetailsWhereInput[]
    NOT?: CustomerChatDetailsWhereInput | CustomerChatDetailsWhereInput[]
    id?: StringFilter<"CustomerChatDetails"> | string
    chatId?: StringFilter<"CustomerChatDetails"> | string
    message?: StringFilter<"CustomerChatDetails"> | string
    sender?: StringFilter<"CustomerChatDetails"> | string
    tokenDetails?: JsonNullableFilter<"CustomerChatDetails">
    createdAt?: DateTimeFilter<"CustomerChatDetails"> | Date | string
    chat?: XOR<CustomerChatsScalarRelationFilter, CustomerChatsWhereInput>
  }

  export type CustomerChatDetailsOrderByWithRelationInput = {
    id?: SortOrder
    chatId?: SortOrder
    message?: SortOrder
    sender?: SortOrder
    tokenDetails?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    chat?: CustomerChatsOrderByWithRelationInput
  }

  export type CustomerChatDetailsWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: CustomerChatDetailsWhereInput | CustomerChatDetailsWhereInput[]
    OR?: CustomerChatDetailsWhereInput[]
    NOT?: CustomerChatDetailsWhereInput | CustomerChatDetailsWhereInput[]
    chatId?: StringFilter<"CustomerChatDetails"> | string
    message?: StringFilter<"CustomerChatDetails"> | string
    sender?: StringFilter<"CustomerChatDetails"> | string
    tokenDetails?: JsonNullableFilter<"CustomerChatDetails">
    createdAt?: DateTimeFilter<"CustomerChatDetails"> | Date | string
    chat?: XOR<CustomerChatsScalarRelationFilter, CustomerChatsWhereInput>
  }, "id">

  export type CustomerChatDetailsOrderByWithAggregationInput = {
    id?: SortOrder
    chatId?: SortOrder
    message?: SortOrder
    sender?: SortOrder
    tokenDetails?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: CustomerChatDetailsCountOrderByAggregateInput
    _max?: CustomerChatDetailsMaxOrderByAggregateInput
    _min?: CustomerChatDetailsMinOrderByAggregateInput
  }

  export type CustomerChatDetailsScalarWhereWithAggregatesInput = {
    AND?: CustomerChatDetailsScalarWhereWithAggregatesInput | CustomerChatDetailsScalarWhereWithAggregatesInput[]
    OR?: CustomerChatDetailsScalarWhereWithAggregatesInput[]
    NOT?: CustomerChatDetailsScalarWhereWithAggregatesInput | CustomerChatDetailsScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"CustomerChatDetails"> | string
    chatId?: StringWithAggregatesFilter<"CustomerChatDetails"> | string
    message?: StringWithAggregatesFilter<"CustomerChatDetails"> | string
    sender?: StringWithAggregatesFilter<"CustomerChatDetails"> | string
    tokenDetails?: JsonNullableWithAggregatesFilter<"CustomerChatDetails">
    createdAt?: DateTimeWithAggregatesFilter<"CustomerChatDetails"> | Date | string
  }

  export type GeoLocationWhereInput = {
    AND?: GeoLocationWhereInput | GeoLocationWhereInput[]
    OR?: GeoLocationWhereInput[]
    NOT?: GeoLocationWhereInput | GeoLocationWhereInput[]
    id?: StringFilter<"GeoLocation"> | string
    chatId?: StringFilter<"GeoLocation"> | string
    ip?: StringFilter<"GeoLocation"> | string
    country?: StringFilter<"GeoLocation"> | string
    countryCode?: StringFilter<"GeoLocation"> | string
    region?: StringFilter<"GeoLocation"> | string
    city?: StringFilter<"GeoLocation"> | string
    timezone?: StringFilter<"GeoLocation"> | string
    organization?: StringFilter<"GeoLocation"> | string
    organization_name?: StringFilter<"GeoLocation"> | string
    latitude?: FloatFilter<"GeoLocation"> | number
    longitude?: FloatFilter<"GeoLocation"> | number
    accuracy?: IntFilter<"GeoLocation"> | number
    createdAt?: DateTimeFilter<"GeoLocation"> | Date | string
    chat?: XOR<CustomerChatsScalarRelationFilter, CustomerChatsWhereInput>
  }

  export type GeoLocationOrderByWithRelationInput = {
    id?: SortOrder
    chatId?: SortOrder
    ip?: SortOrder
    country?: SortOrder
    countryCode?: SortOrder
    region?: SortOrder
    city?: SortOrder
    timezone?: SortOrder
    organization?: SortOrder
    organization_name?: SortOrder
    latitude?: SortOrder
    longitude?: SortOrder
    accuracy?: SortOrder
    createdAt?: SortOrder
    chat?: CustomerChatsOrderByWithRelationInput
  }

  export type GeoLocationWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: GeoLocationWhereInput | GeoLocationWhereInput[]
    OR?: GeoLocationWhereInput[]
    NOT?: GeoLocationWhereInput | GeoLocationWhereInput[]
    chatId?: StringFilter<"GeoLocation"> | string
    ip?: StringFilter<"GeoLocation"> | string
    country?: StringFilter<"GeoLocation"> | string
    countryCode?: StringFilter<"GeoLocation"> | string
    region?: StringFilter<"GeoLocation"> | string
    city?: StringFilter<"GeoLocation"> | string
    timezone?: StringFilter<"GeoLocation"> | string
    organization?: StringFilter<"GeoLocation"> | string
    organization_name?: StringFilter<"GeoLocation"> | string
    latitude?: FloatFilter<"GeoLocation"> | number
    longitude?: FloatFilter<"GeoLocation"> | number
    accuracy?: IntFilter<"GeoLocation"> | number
    createdAt?: DateTimeFilter<"GeoLocation"> | Date | string
    chat?: XOR<CustomerChatsScalarRelationFilter, CustomerChatsWhereInput>
  }, "id">

  export type GeoLocationOrderByWithAggregationInput = {
    id?: SortOrder
    chatId?: SortOrder
    ip?: SortOrder
    country?: SortOrder
    countryCode?: SortOrder
    region?: SortOrder
    city?: SortOrder
    timezone?: SortOrder
    organization?: SortOrder
    organization_name?: SortOrder
    latitude?: SortOrder
    longitude?: SortOrder
    accuracy?: SortOrder
    createdAt?: SortOrder
    _count?: GeoLocationCountOrderByAggregateInput
    _avg?: GeoLocationAvgOrderByAggregateInput
    _max?: GeoLocationMaxOrderByAggregateInput
    _min?: GeoLocationMinOrderByAggregateInput
    _sum?: GeoLocationSumOrderByAggregateInput
  }

  export type GeoLocationScalarWhereWithAggregatesInput = {
    AND?: GeoLocationScalarWhereWithAggregatesInput | GeoLocationScalarWhereWithAggregatesInput[]
    OR?: GeoLocationScalarWhereWithAggregatesInput[]
    NOT?: GeoLocationScalarWhereWithAggregatesInput | GeoLocationScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"GeoLocation"> | string
    chatId?: StringWithAggregatesFilter<"GeoLocation"> | string
    ip?: StringWithAggregatesFilter<"GeoLocation"> | string
    country?: StringWithAggregatesFilter<"GeoLocation"> | string
    countryCode?: StringWithAggregatesFilter<"GeoLocation"> | string
    region?: StringWithAggregatesFilter<"GeoLocation"> | string
    city?: StringWithAggregatesFilter<"GeoLocation"> | string
    timezone?: StringWithAggregatesFilter<"GeoLocation"> | string
    organization?: StringWithAggregatesFilter<"GeoLocation"> | string
    organization_name?: StringWithAggregatesFilter<"GeoLocation"> | string
    latitude?: FloatWithAggregatesFilter<"GeoLocation"> | number
    longitude?: FloatWithAggregatesFilter<"GeoLocation"> | number
    accuracy?: IntWithAggregatesFilter<"GeoLocation"> | number
    createdAt?: DateTimeWithAggregatesFilter<"GeoLocation"> | Date | string
  }

  export type UserCreateInput = {
    id?: string
    name: string
    email: string
    phonenumber?: string | null
    password: string
    refreshToken?: string | null
    emailVerified?: boolean
    phoneVerified?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    Storage?: StorageCreateNestedManyWithoutUserInput
    CustomerBots?: CustomerBotsCreateNestedManyWithoutUserInput
    Quota?: QuotaCreateNestedManyWithoutUserInput
    CustomerChats?: CustomerChatsCreateNestedManyWithoutUserInput
    Content?: ContentCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateInput = {
    id?: string
    name: string
    email: string
    phonenumber?: string | null
    password: string
    refreshToken?: string | null
    emailVerified?: boolean
    phoneVerified?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    Storage?: StorageUncheckedCreateNestedManyWithoutUserInput
    CustomerBots?: CustomerBotsUncheckedCreateNestedManyWithoutUserInput
    Quota?: QuotaUncheckedCreateNestedManyWithoutUserInput
    CustomerChats?: CustomerChatsUncheckedCreateNestedManyWithoutUserInput
    Content?: ContentUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phonenumber?: NullableStringFieldUpdateOperationsInput | string | null
    password?: StringFieldUpdateOperationsInput | string
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    phoneVerified?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    Storage?: StorageUpdateManyWithoutUserNestedInput
    CustomerBots?: CustomerBotsUpdateManyWithoutUserNestedInput
    Quota?: QuotaUpdateManyWithoutUserNestedInput
    CustomerChats?: CustomerChatsUpdateManyWithoutUserNestedInput
    Content?: ContentUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phonenumber?: NullableStringFieldUpdateOperationsInput | string | null
    password?: StringFieldUpdateOperationsInput | string
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    phoneVerified?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    Storage?: StorageUncheckedUpdateManyWithoutUserNestedInput
    CustomerBots?: CustomerBotsUncheckedUpdateManyWithoutUserNestedInput
    Quota?: QuotaUncheckedUpdateManyWithoutUserNestedInput
    CustomerChats?: CustomerChatsUncheckedUpdateManyWithoutUserNestedInput
    Content?: ContentUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateManyInput = {
    id?: string
    name: string
    email: string
    phonenumber?: string | null
    password: string
    refreshToken?: string | null
    emailVerified?: boolean
    phoneVerified?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phonenumber?: NullableStringFieldUpdateOperationsInput | string | null
    password?: StringFieldUpdateOperationsInput | string
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    phoneVerified?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phonenumber?: NullableStringFieldUpdateOperationsInput | string | null
    password?: StringFieldUpdateOperationsInput | string
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    phoneVerified?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type QuotaCreateInput = {
    id?: string
    quotaType?: $Enums.QuotaType | null
    limit?: number
    used?: number
    user: UserCreateNestedOneWithoutQuotaInput
  }

  export type QuotaUncheckedCreateInput = {
    id?: string
    userId: string
    quotaType?: $Enums.QuotaType | null
    limit?: number
    used?: number
  }

  export type QuotaUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    quotaType?: NullableEnumQuotaTypeFieldUpdateOperationsInput | $Enums.QuotaType | null
    limit?: IntFieldUpdateOperationsInput | number
    used?: IntFieldUpdateOperationsInput | number
    user?: UserUpdateOneRequiredWithoutQuotaNestedInput
  }

  export type QuotaUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    quotaType?: NullableEnumQuotaTypeFieldUpdateOperationsInput | $Enums.QuotaType | null
    limit?: IntFieldUpdateOperationsInput | number
    used?: IntFieldUpdateOperationsInput | number
  }

  export type QuotaCreateManyInput = {
    id?: string
    userId: string
    quotaType?: $Enums.QuotaType | null
    limit?: number
    used?: number
  }

  export type QuotaUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    quotaType?: NullableEnumQuotaTypeFieldUpdateOperationsInput | $Enums.QuotaType | null
    limit?: IntFieldUpdateOperationsInput | number
    used?: IntFieldUpdateOperationsInput | number
  }

  export type QuotaUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    quotaType?: NullableEnumQuotaTypeFieldUpdateOperationsInput | $Enums.QuotaType | null
    limit?: IntFieldUpdateOperationsInput | number
    used?: IntFieldUpdateOperationsInput | number
  }

  export type StorageCreateInput = {
    id?: string
    botId: string
    fileName: string
    fileUrl: string
    type: string
    size: string
    status: string
    taskId: string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    isDeleted?: boolean
    user: UserCreateNestedOneWithoutStorageInput
  }

  export type StorageUncheckedCreateInput = {
    id?: string
    userId: string
    botId: string
    fileName: string
    fileUrl: string
    type: string
    size: string
    status: string
    taskId: string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    isDeleted?: boolean
  }

  export type StorageUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    fileName?: StringFieldUpdateOperationsInput | string
    fileUrl?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    taskId?: StringFieldUpdateOperationsInput | string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    user?: UserUpdateOneRequiredWithoutStorageNestedInput
  }

  export type StorageUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    fileName?: StringFieldUpdateOperationsInput | string
    fileUrl?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    taskId?: StringFieldUpdateOperationsInput | string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type StorageCreateManyInput = {
    id?: string
    userId: string
    botId: string
    fileName: string
    fileUrl: string
    type: string
    size: string
    status: string
    taskId: string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    isDeleted?: boolean
  }

  export type StorageUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    fileName?: StringFieldUpdateOperationsInput | string
    fileUrl?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    taskId?: StringFieldUpdateOperationsInput | string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type StorageUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    fileName?: StringFieldUpdateOperationsInput | string
    fileUrl?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    taskId?: StringFieldUpdateOperationsInput | string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ContentCreateInput = {
    id?: string
    botId: string
    content?: NullableJsonNullValueInput | InputJsonValue
    type: string
    status: string
    taskId: string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    isDeleted?: boolean
    user: UserCreateNestedOneWithoutContentInput
  }

  export type ContentUncheckedCreateInput = {
    id?: string
    userId: string
    botId: string
    content?: NullableJsonNullValueInput | InputJsonValue
    type: string
    status: string
    taskId: string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    isDeleted?: boolean
  }

  export type ContentUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    content?: NullableJsonNullValueInput | InputJsonValue
    type?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    taskId?: StringFieldUpdateOperationsInput | string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    user?: UserUpdateOneRequiredWithoutContentNestedInput
  }

  export type ContentUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    content?: NullableJsonNullValueInput | InputJsonValue
    type?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    taskId?: StringFieldUpdateOperationsInput | string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ContentCreateManyInput = {
    id?: string
    userId: string
    botId: string
    content?: NullableJsonNullValueInput | InputJsonValue
    type: string
    status: string
    taskId: string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    isDeleted?: boolean
  }

  export type ContentUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    content?: NullableJsonNullValueInput | InputJsonValue
    type?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    taskId?: StringFieldUpdateOperationsInput | string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ContentUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    content?: NullableJsonNullValueInput | InputJsonValue
    type?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    taskId?: StringFieldUpdateOperationsInput | string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type CustomerBotsCreateInput = {
    id?: string
    botName: string
    botAvatar: string
    systemPrompt?: string
    settings?: NullableJsonNullValueInput | InputJsonValue
    active?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    isDeleted?: boolean
    deletedAt?: Date | string | null
    user: UserCreateNestedOneWithoutCustomerBotsInput
  }

  export type CustomerBotsUncheckedCreateInput = {
    id?: string
    userId: string
    botName: string
    botAvatar: string
    systemPrompt?: string
    settings?: NullableJsonNullValueInput | InputJsonValue
    active?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    isDeleted?: boolean
    deletedAt?: Date | string | null
  }

  export type CustomerBotsUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    botName?: StringFieldUpdateOperationsInput | string
    botAvatar?: StringFieldUpdateOperationsInput | string
    systemPrompt?: StringFieldUpdateOperationsInput | string
    settings?: NullableJsonNullValueInput | InputJsonValue
    active?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    user?: UserUpdateOneRequiredWithoutCustomerBotsNestedInput
  }

  export type CustomerBotsUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    botName?: StringFieldUpdateOperationsInput | string
    botAvatar?: StringFieldUpdateOperationsInput | string
    systemPrompt?: StringFieldUpdateOperationsInput | string
    settings?: NullableJsonNullValueInput | InputJsonValue
    active?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type CustomerBotsCreateManyInput = {
    id?: string
    userId: string
    botName: string
    botAvatar: string
    systemPrompt?: string
    settings?: NullableJsonNullValueInput | InputJsonValue
    active?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    isDeleted?: boolean
    deletedAt?: Date | string | null
  }

  export type CustomerBotsUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    botName?: StringFieldUpdateOperationsInput | string
    botAvatar?: StringFieldUpdateOperationsInput | string
    systemPrompt?: StringFieldUpdateOperationsInput | string
    settings?: NullableJsonNullValueInput | InputJsonValue
    active?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type CustomerBotsUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    botName?: StringFieldUpdateOperationsInput | string
    botAvatar?: StringFieldUpdateOperationsInput | string
    systemPrompt?: StringFieldUpdateOperationsInput | string
    settings?: NullableJsonNullValueInput | InputJsonValue
    active?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type CustomerChatsCreateInput = {
    id?: string
    botId: string
    chatId: string
    createdAt?: Date | string
    updatedAt?: Date | string
    isDeleted?: boolean
    deletedAt?: Date | string | null
    totalTokens?: number | null
    user: UserCreateNestedOneWithoutCustomerChatsInput
    CustomerChatDetails?: CustomerChatDetailsCreateNestedManyWithoutChatInput
    GeoLocation?: GeoLocationCreateNestedManyWithoutChatInput
  }

  export type CustomerChatsUncheckedCreateInput = {
    id?: string
    userId: string
    botId: string
    chatId: string
    createdAt?: Date | string
    updatedAt?: Date | string
    isDeleted?: boolean
    deletedAt?: Date | string | null
    totalTokens?: number | null
    CustomerChatDetails?: CustomerChatDetailsUncheckedCreateNestedManyWithoutChatInput
    GeoLocation?: GeoLocationUncheckedCreateNestedManyWithoutChatInput
  }

  export type CustomerChatsUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    chatId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalTokens?: NullableIntFieldUpdateOperationsInput | number | null
    user?: UserUpdateOneRequiredWithoutCustomerChatsNestedInput
    CustomerChatDetails?: CustomerChatDetailsUpdateManyWithoutChatNestedInput
    GeoLocation?: GeoLocationUpdateManyWithoutChatNestedInput
  }

  export type CustomerChatsUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    chatId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalTokens?: NullableIntFieldUpdateOperationsInput | number | null
    CustomerChatDetails?: CustomerChatDetailsUncheckedUpdateManyWithoutChatNestedInput
    GeoLocation?: GeoLocationUncheckedUpdateManyWithoutChatNestedInput
  }

  export type CustomerChatsCreateManyInput = {
    id?: string
    userId: string
    botId: string
    chatId: string
    createdAt?: Date | string
    updatedAt?: Date | string
    isDeleted?: boolean
    deletedAt?: Date | string | null
    totalTokens?: number | null
  }

  export type CustomerChatsUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    chatId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalTokens?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type CustomerChatsUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    chatId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalTokens?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type CustomerChatDetailsCreateInput = {
    id?: string
    message: string
    sender: string
    tokenDetails?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    chat: CustomerChatsCreateNestedOneWithoutCustomerChatDetailsInput
  }

  export type CustomerChatDetailsUncheckedCreateInput = {
    id?: string
    chatId: string
    message: string
    sender: string
    tokenDetails?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type CustomerChatDetailsUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    message?: StringFieldUpdateOperationsInput | string
    sender?: StringFieldUpdateOperationsInput | string
    tokenDetails?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    chat?: CustomerChatsUpdateOneRequiredWithoutCustomerChatDetailsNestedInput
  }

  export type CustomerChatDetailsUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    chatId?: StringFieldUpdateOperationsInput | string
    message?: StringFieldUpdateOperationsInput | string
    sender?: StringFieldUpdateOperationsInput | string
    tokenDetails?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CustomerChatDetailsCreateManyInput = {
    id?: string
    chatId: string
    message: string
    sender: string
    tokenDetails?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type CustomerChatDetailsUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    message?: StringFieldUpdateOperationsInput | string
    sender?: StringFieldUpdateOperationsInput | string
    tokenDetails?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CustomerChatDetailsUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    chatId?: StringFieldUpdateOperationsInput | string
    message?: StringFieldUpdateOperationsInput | string
    sender?: StringFieldUpdateOperationsInput | string
    tokenDetails?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GeoLocationCreateInput = {
    id?: string
    ip: string
    country: string
    countryCode: string
    region: string
    city: string
    timezone: string
    organization: string
    organization_name: string
    latitude: number
    longitude: number
    accuracy: number
    createdAt?: Date | string
    chat: CustomerChatsCreateNestedOneWithoutGeoLocationInput
  }

  export type GeoLocationUncheckedCreateInput = {
    id?: string
    chatId: string
    ip: string
    country: string
    countryCode: string
    region: string
    city: string
    timezone: string
    organization: string
    organization_name: string
    latitude: number
    longitude: number
    accuracy: number
    createdAt?: Date | string
  }

  export type GeoLocationUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    ip?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    countryCode?: StringFieldUpdateOperationsInput | string
    region?: StringFieldUpdateOperationsInput | string
    city?: StringFieldUpdateOperationsInput | string
    timezone?: StringFieldUpdateOperationsInput | string
    organization?: StringFieldUpdateOperationsInput | string
    organization_name?: StringFieldUpdateOperationsInput | string
    latitude?: FloatFieldUpdateOperationsInput | number
    longitude?: FloatFieldUpdateOperationsInput | number
    accuracy?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    chat?: CustomerChatsUpdateOneRequiredWithoutGeoLocationNestedInput
  }

  export type GeoLocationUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    chatId?: StringFieldUpdateOperationsInput | string
    ip?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    countryCode?: StringFieldUpdateOperationsInput | string
    region?: StringFieldUpdateOperationsInput | string
    city?: StringFieldUpdateOperationsInput | string
    timezone?: StringFieldUpdateOperationsInput | string
    organization?: StringFieldUpdateOperationsInput | string
    organization_name?: StringFieldUpdateOperationsInput | string
    latitude?: FloatFieldUpdateOperationsInput | number
    longitude?: FloatFieldUpdateOperationsInput | number
    accuracy?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GeoLocationCreateManyInput = {
    id?: string
    chatId: string
    ip: string
    country: string
    countryCode: string
    region: string
    city: string
    timezone: string
    organization: string
    organization_name: string
    latitude: number
    longitude: number
    accuracy: number
    createdAt?: Date | string
  }

  export type GeoLocationUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    ip?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    countryCode?: StringFieldUpdateOperationsInput | string
    region?: StringFieldUpdateOperationsInput | string
    city?: StringFieldUpdateOperationsInput | string
    timezone?: StringFieldUpdateOperationsInput | string
    organization?: StringFieldUpdateOperationsInput | string
    organization_name?: StringFieldUpdateOperationsInput | string
    latitude?: FloatFieldUpdateOperationsInput | number
    longitude?: FloatFieldUpdateOperationsInput | number
    accuracy?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GeoLocationUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    chatId?: StringFieldUpdateOperationsInput | string
    ip?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    countryCode?: StringFieldUpdateOperationsInput | string
    region?: StringFieldUpdateOperationsInput | string
    city?: StringFieldUpdateOperationsInput | string
    timezone?: StringFieldUpdateOperationsInput | string
    organization?: StringFieldUpdateOperationsInput | string
    organization_name?: StringFieldUpdateOperationsInput | string
    latitude?: FloatFieldUpdateOperationsInput | number
    longitude?: FloatFieldUpdateOperationsInput | number
    accuracy?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type StorageListRelationFilter = {
    every?: StorageWhereInput
    some?: StorageWhereInput
    none?: StorageWhereInput
  }

  export type CustomerBotsListRelationFilter = {
    every?: CustomerBotsWhereInput
    some?: CustomerBotsWhereInput
    none?: CustomerBotsWhereInput
  }

  export type QuotaListRelationFilter = {
    every?: QuotaWhereInput
    some?: QuotaWhereInput
    none?: QuotaWhereInput
  }

  export type CustomerChatsListRelationFilter = {
    every?: CustomerChatsWhereInput
    some?: CustomerChatsWhereInput
    none?: CustomerChatsWhereInput
  }

  export type ContentListRelationFilter = {
    every?: ContentWhereInput
    some?: ContentWhereInput
    none?: ContentWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type StorageOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type CustomerBotsOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type QuotaOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type CustomerChatsOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ContentOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    phonenumber?: SortOrder
    password?: SortOrder
    refreshToken?: SortOrder
    emailVerified?: SortOrder
    phoneVerified?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    phonenumber?: SortOrder
    password?: SortOrder
    refreshToken?: SortOrder
    emailVerified?: SortOrder
    phoneVerified?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    phonenumber?: SortOrder
    password?: SortOrder
    refreshToken?: SortOrder
    emailVerified?: SortOrder
    phoneVerified?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type EnumQuotaTypeNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.QuotaType | EnumQuotaTypeFieldRefInput<$PrismaModel> | null
    in?: $Enums.QuotaType[] | ListEnumQuotaTypeFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.QuotaType[] | ListEnumQuotaTypeFieldRefInput<$PrismaModel> | null
    not?: NestedEnumQuotaTypeNullableFilter<$PrismaModel> | $Enums.QuotaType | null
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type UserScalarRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type QuotaUserIdQuotaTypeCompoundUniqueInput = {
    userId: string
    quotaType: $Enums.QuotaType
  }

  export type QuotaCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    quotaType?: SortOrder
    limit?: SortOrder
    used?: SortOrder
  }

  export type QuotaAvgOrderByAggregateInput = {
    limit?: SortOrder
    used?: SortOrder
  }

  export type QuotaMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    quotaType?: SortOrder
    limit?: SortOrder
    used?: SortOrder
  }

  export type QuotaMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    quotaType?: SortOrder
    limit?: SortOrder
    used?: SortOrder
  }

  export type QuotaSumOrderByAggregateInput = {
    limit?: SortOrder
    used?: SortOrder
  }

  export type EnumQuotaTypeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.QuotaType | EnumQuotaTypeFieldRefInput<$PrismaModel> | null
    in?: $Enums.QuotaType[] | ListEnumQuotaTypeFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.QuotaType[] | ListEnumQuotaTypeFieldRefInput<$PrismaModel> | null
    not?: NestedEnumQuotaTypeNullableWithAggregatesFilter<$PrismaModel> | $Enums.QuotaType | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumQuotaTypeNullableFilter<$PrismaModel>
    _max?: NestedEnumQuotaTypeNullableFilter<$PrismaModel>
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }
  export type JsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type StorageCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    botId?: SortOrder
    fileName?: SortOrder
    fileUrl?: SortOrder
    type?: SortOrder
    size?: SortOrder
    status?: SortOrder
    taskId?: SortOrder
    ingestionInfo?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrder
    isDeleted?: SortOrder
  }

  export type StorageMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    botId?: SortOrder
    fileName?: SortOrder
    fileUrl?: SortOrder
    type?: SortOrder
    size?: SortOrder
    status?: SortOrder
    taskId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrder
    isDeleted?: SortOrder
  }

  export type StorageMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    botId?: SortOrder
    fileName?: SortOrder
    fileUrl?: SortOrder
    type?: SortOrder
    size?: SortOrder
    status?: SortOrder
    taskId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrder
    isDeleted?: SortOrder
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type ContentCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    botId?: SortOrder
    content?: SortOrder
    type?: SortOrder
    status?: SortOrder
    taskId?: SortOrder
    ingestionInfo?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrder
    isDeleted?: SortOrder
  }

  export type ContentMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    botId?: SortOrder
    type?: SortOrder
    status?: SortOrder
    taskId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrder
    isDeleted?: SortOrder
  }

  export type ContentMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    botId?: SortOrder
    type?: SortOrder
    status?: SortOrder
    taskId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrder
    isDeleted?: SortOrder
  }

  export type CustomerBotsCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    botName?: SortOrder
    botAvatar?: SortOrder
    systemPrompt?: SortOrder
    settings?: SortOrder
    active?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrder
  }

  export type CustomerBotsMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    botName?: SortOrder
    botAvatar?: SortOrder
    systemPrompt?: SortOrder
    active?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrder
  }

  export type CustomerBotsMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    botName?: SortOrder
    botAvatar?: SortOrder
    systemPrompt?: SortOrder
    active?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrder
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type CustomerChatDetailsListRelationFilter = {
    every?: CustomerChatDetailsWhereInput
    some?: CustomerChatDetailsWhereInput
    none?: CustomerChatDetailsWhereInput
  }

  export type GeoLocationListRelationFilter = {
    every?: GeoLocationWhereInput
    some?: GeoLocationWhereInput
    none?: GeoLocationWhereInput
  }

  export type CustomerChatDetailsOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type GeoLocationOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type CustomerChatsCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    botId?: SortOrder
    chatId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrder
    totalTokens?: SortOrder
  }

  export type CustomerChatsAvgOrderByAggregateInput = {
    totalTokens?: SortOrder
  }

  export type CustomerChatsMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    botId?: SortOrder
    chatId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrder
    totalTokens?: SortOrder
  }

  export type CustomerChatsMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    botId?: SortOrder
    chatId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    isDeleted?: SortOrder
    deletedAt?: SortOrder
    totalTokens?: SortOrder
  }

  export type CustomerChatsSumOrderByAggregateInput = {
    totalTokens?: SortOrder
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type CustomerChatsScalarRelationFilter = {
    is?: CustomerChatsWhereInput
    isNot?: CustomerChatsWhereInput
  }

  export type CustomerChatDetailsCountOrderByAggregateInput = {
    id?: SortOrder
    chatId?: SortOrder
    message?: SortOrder
    sender?: SortOrder
    tokenDetails?: SortOrder
    createdAt?: SortOrder
  }

  export type CustomerChatDetailsMaxOrderByAggregateInput = {
    id?: SortOrder
    chatId?: SortOrder
    message?: SortOrder
    sender?: SortOrder
    createdAt?: SortOrder
  }

  export type CustomerChatDetailsMinOrderByAggregateInput = {
    id?: SortOrder
    chatId?: SortOrder
    message?: SortOrder
    sender?: SortOrder
    createdAt?: SortOrder
  }

  export type FloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type GeoLocationCountOrderByAggregateInput = {
    id?: SortOrder
    chatId?: SortOrder
    ip?: SortOrder
    country?: SortOrder
    countryCode?: SortOrder
    region?: SortOrder
    city?: SortOrder
    timezone?: SortOrder
    organization?: SortOrder
    organization_name?: SortOrder
    latitude?: SortOrder
    longitude?: SortOrder
    accuracy?: SortOrder
    createdAt?: SortOrder
  }

  export type GeoLocationAvgOrderByAggregateInput = {
    latitude?: SortOrder
    longitude?: SortOrder
    accuracy?: SortOrder
  }

  export type GeoLocationMaxOrderByAggregateInput = {
    id?: SortOrder
    chatId?: SortOrder
    ip?: SortOrder
    country?: SortOrder
    countryCode?: SortOrder
    region?: SortOrder
    city?: SortOrder
    timezone?: SortOrder
    organization?: SortOrder
    organization_name?: SortOrder
    latitude?: SortOrder
    longitude?: SortOrder
    accuracy?: SortOrder
    createdAt?: SortOrder
  }

  export type GeoLocationMinOrderByAggregateInput = {
    id?: SortOrder
    chatId?: SortOrder
    ip?: SortOrder
    country?: SortOrder
    countryCode?: SortOrder
    region?: SortOrder
    city?: SortOrder
    timezone?: SortOrder
    organization?: SortOrder
    organization_name?: SortOrder
    latitude?: SortOrder
    longitude?: SortOrder
    accuracy?: SortOrder
    createdAt?: SortOrder
  }

  export type GeoLocationSumOrderByAggregateInput = {
    latitude?: SortOrder
    longitude?: SortOrder
    accuracy?: SortOrder
  }

  export type FloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type StorageCreateNestedManyWithoutUserInput = {
    create?: XOR<StorageCreateWithoutUserInput, StorageUncheckedCreateWithoutUserInput> | StorageCreateWithoutUserInput[] | StorageUncheckedCreateWithoutUserInput[]
    connectOrCreate?: StorageCreateOrConnectWithoutUserInput | StorageCreateOrConnectWithoutUserInput[]
    createMany?: StorageCreateManyUserInputEnvelope
    connect?: StorageWhereUniqueInput | StorageWhereUniqueInput[]
  }

  export type CustomerBotsCreateNestedManyWithoutUserInput = {
    create?: XOR<CustomerBotsCreateWithoutUserInput, CustomerBotsUncheckedCreateWithoutUserInput> | CustomerBotsCreateWithoutUserInput[] | CustomerBotsUncheckedCreateWithoutUserInput[]
    connectOrCreate?: CustomerBotsCreateOrConnectWithoutUserInput | CustomerBotsCreateOrConnectWithoutUserInput[]
    createMany?: CustomerBotsCreateManyUserInputEnvelope
    connect?: CustomerBotsWhereUniqueInput | CustomerBotsWhereUniqueInput[]
  }

  export type QuotaCreateNestedManyWithoutUserInput = {
    create?: XOR<QuotaCreateWithoutUserInput, QuotaUncheckedCreateWithoutUserInput> | QuotaCreateWithoutUserInput[] | QuotaUncheckedCreateWithoutUserInput[]
    connectOrCreate?: QuotaCreateOrConnectWithoutUserInput | QuotaCreateOrConnectWithoutUserInput[]
    createMany?: QuotaCreateManyUserInputEnvelope
    connect?: QuotaWhereUniqueInput | QuotaWhereUniqueInput[]
  }

  export type CustomerChatsCreateNestedManyWithoutUserInput = {
    create?: XOR<CustomerChatsCreateWithoutUserInput, CustomerChatsUncheckedCreateWithoutUserInput> | CustomerChatsCreateWithoutUserInput[] | CustomerChatsUncheckedCreateWithoutUserInput[]
    connectOrCreate?: CustomerChatsCreateOrConnectWithoutUserInput | CustomerChatsCreateOrConnectWithoutUserInput[]
    createMany?: CustomerChatsCreateManyUserInputEnvelope
    connect?: CustomerChatsWhereUniqueInput | CustomerChatsWhereUniqueInput[]
  }

  export type ContentCreateNestedManyWithoutUserInput = {
    create?: XOR<ContentCreateWithoutUserInput, ContentUncheckedCreateWithoutUserInput> | ContentCreateWithoutUserInput[] | ContentUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ContentCreateOrConnectWithoutUserInput | ContentCreateOrConnectWithoutUserInput[]
    createMany?: ContentCreateManyUserInputEnvelope
    connect?: ContentWhereUniqueInput | ContentWhereUniqueInput[]
  }

  export type StorageUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<StorageCreateWithoutUserInput, StorageUncheckedCreateWithoutUserInput> | StorageCreateWithoutUserInput[] | StorageUncheckedCreateWithoutUserInput[]
    connectOrCreate?: StorageCreateOrConnectWithoutUserInput | StorageCreateOrConnectWithoutUserInput[]
    createMany?: StorageCreateManyUserInputEnvelope
    connect?: StorageWhereUniqueInput | StorageWhereUniqueInput[]
  }

  export type CustomerBotsUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<CustomerBotsCreateWithoutUserInput, CustomerBotsUncheckedCreateWithoutUserInput> | CustomerBotsCreateWithoutUserInput[] | CustomerBotsUncheckedCreateWithoutUserInput[]
    connectOrCreate?: CustomerBotsCreateOrConnectWithoutUserInput | CustomerBotsCreateOrConnectWithoutUserInput[]
    createMany?: CustomerBotsCreateManyUserInputEnvelope
    connect?: CustomerBotsWhereUniqueInput | CustomerBotsWhereUniqueInput[]
  }

  export type QuotaUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<QuotaCreateWithoutUserInput, QuotaUncheckedCreateWithoutUserInput> | QuotaCreateWithoutUserInput[] | QuotaUncheckedCreateWithoutUserInput[]
    connectOrCreate?: QuotaCreateOrConnectWithoutUserInput | QuotaCreateOrConnectWithoutUserInput[]
    createMany?: QuotaCreateManyUserInputEnvelope
    connect?: QuotaWhereUniqueInput | QuotaWhereUniqueInput[]
  }

  export type CustomerChatsUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<CustomerChatsCreateWithoutUserInput, CustomerChatsUncheckedCreateWithoutUserInput> | CustomerChatsCreateWithoutUserInput[] | CustomerChatsUncheckedCreateWithoutUserInput[]
    connectOrCreate?: CustomerChatsCreateOrConnectWithoutUserInput | CustomerChatsCreateOrConnectWithoutUserInput[]
    createMany?: CustomerChatsCreateManyUserInputEnvelope
    connect?: CustomerChatsWhereUniqueInput | CustomerChatsWhereUniqueInput[]
  }

  export type ContentUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<ContentCreateWithoutUserInput, ContentUncheckedCreateWithoutUserInput> | ContentCreateWithoutUserInput[] | ContentUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ContentCreateOrConnectWithoutUserInput | ContentCreateOrConnectWithoutUserInput[]
    createMany?: ContentCreateManyUserInputEnvelope
    connect?: ContentWhereUniqueInput | ContentWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type StorageUpdateManyWithoutUserNestedInput = {
    create?: XOR<StorageCreateWithoutUserInput, StorageUncheckedCreateWithoutUserInput> | StorageCreateWithoutUserInput[] | StorageUncheckedCreateWithoutUserInput[]
    connectOrCreate?: StorageCreateOrConnectWithoutUserInput | StorageCreateOrConnectWithoutUserInput[]
    upsert?: StorageUpsertWithWhereUniqueWithoutUserInput | StorageUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: StorageCreateManyUserInputEnvelope
    set?: StorageWhereUniqueInput | StorageWhereUniqueInput[]
    disconnect?: StorageWhereUniqueInput | StorageWhereUniqueInput[]
    delete?: StorageWhereUniqueInput | StorageWhereUniqueInput[]
    connect?: StorageWhereUniqueInput | StorageWhereUniqueInput[]
    update?: StorageUpdateWithWhereUniqueWithoutUserInput | StorageUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: StorageUpdateManyWithWhereWithoutUserInput | StorageUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: StorageScalarWhereInput | StorageScalarWhereInput[]
  }

  export type CustomerBotsUpdateManyWithoutUserNestedInput = {
    create?: XOR<CustomerBotsCreateWithoutUserInput, CustomerBotsUncheckedCreateWithoutUserInput> | CustomerBotsCreateWithoutUserInput[] | CustomerBotsUncheckedCreateWithoutUserInput[]
    connectOrCreate?: CustomerBotsCreateOrConnectWithoutUserInput | CustomerBotsCreateOrConnectWithoutUserInput[]
    upsert?: CustomerBotsUpsertWithWhereUniqueWithoutUserInput | CustomerBotsUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: CustomerBotsCreateManyUserInputEnvelope
    set?: CustomerBotsWhereUniqueInput | CustomerBotsWhereUniqueInput[]
    disconnect?: CustomerBotsWhereUniqueInput | CustomerBotsWhereUniqueInput[]
    delete?: CustomerBotsWhereUniqueInput | CustomerBotsWhereUniqueInput[]
    connect?: CustomerBotsWhereUniqueInput | CustomerBotsWhereUniqueInput[]
    update?: CustomerBotsUpdateWithWhereUniqueWithoutUserInput | CustomerBotsUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: CustomerBotsUpdateManyWithWhereWithoutUserInput | CustomerBotsUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: CustomerBotsScalarWhereInput | CustomerBotsScalarWhereInput[]
  }

  export type QuotaUpdateManyWithoutUserNestedInput = {
    create?: XOR<QuotaCreateWithoutUserInput, QuotaUncheckedCreateWithoutUserInput> | QuotaCreateWithoutUserInput[] | QuotaUncheckedCreateWithoutUserInput[]
    connectOrCreate?: QuotaCreateOrConnectWithoutUserInput | QuotaCreateOrConnectWithoutUserInput[]
    upsert?: QuotaUpsertWithWhereUniqueWithoutUserInput | QuotaUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: QuotaCreateManyUserInputEnvelope
    set?: QuotaWhereUniqueInput | QuotaWhereUniqueInput[]
    disconnect?: QuotaWhereUniqueInput | QuotaWhereUniqueInput[]
    delete?: QuotaWhereUniqueInput | QuotaWhereUniqueInput[]
    connect?: QuotaWhereUniqueInput | QuotaWhereUniqueInput[]
    update?: QuotaUpdateWithWhereUniqueWithoutUserInput | QuotaUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: QuotaUpdateManyWithWhereWithoutUserInput | QuotaUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: QuotaScalarWhereInput | QuotaScalarWhereInput[]
  }

  export type CustomerChatsUpdateManyWithoutUserNestedInput = {
    create?: XOR<CustomerChatsCreateWithoutUserInput, CustomerChatsUncheckedCreateWithoutUserInput> | CustomerChatsCreateWithoutUserInput[] | CustomerChatsUncheckedCreateWithoutUserInput[]
    connectOrCreate?: CustomerChatsCreateOrConnectWithoutUserInput | CustomerChatsCreateOrConnectWithoutUserInput[]
    upsert?: CustomerChatsUpsertWithWhereUniqueWithoutUserInput | CustomerChatsUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: CustomerChatsCreateManyUserInputEnvelope
    set?: CustomerChatsWhereUniqueInput | CustomerChatsWhereUniqueInput[]
    disconnect?: CustomerChatsWhereUniqueInput | CustomerChatsWhereUniqueInput[]
    delete?: CustomerChatsWhereUniqueInput | CustomerChatsWhereUniqueInput[]
    connect?: CustomerChatsWhereUniqueInput | CustomerChatsWhereUniqueInput[]
    update?: CustomerChatsUpdateWithWhereUniqueWithoutUserInput | CustomerChatsUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: CustomerChatsUpdateManyWithWhereWithoutUserInput | CustomerChatsUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: CustomerChatsScalarWhereInput | CustomerChatsScalarWhereInput[]
  }

  export type ContentUpdateManyWithoutUserNestedInput = {
    create?: XOR<ContentCreateWithoutUserInput, ContentUncheckedCreateWithoutUserInput> | ContentCreateWithoutUserInput[] | ContentUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ContentCreateOrConnectWithoutUserInput | ContentCreateOrConnectWithoutUserInput[]
    upsert?: ContentUpsertWithWhereUniqueWithoutUserInput | ContentUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: ContentCreateManyUserInputEnvelope
    set?: ContentWhereUniqueInput | ContentWhereUniqueInput[]
    disconnect?: ContentWhereUniqueInput | ContentWhereUniqueInput[]
    delete?: ContentWhereUniqueInput | ContentWhereUniqueInput[]
    connect?: ContentWhereUniqueInput | ContentWhereUniqueInput[]
    update?: ContentUpdateWithWhereUniqueWithoutUserInput | ContentUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: ContentUpdateManyWithWhereWithoutUserInput | ContentUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: ContentScalarWhereInput | ContentScalarWhereInput[]
  }

  export type StorageUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<StorageCreateWithoutUserInput, StorageUncheckedCreateWithoutUserInput> | StorageCreateWithoutUserInput[] | StorageUncheckedCreateWithoutUserInput[]
    connectOrCreate?: StorageCreateOrConnectWithoutUserInput | StorageCreateOrConnectWithoutUserInput[]
    upsert?: StorageUpsertWithWhereUniqueWithoutUserInput | StorageUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: StorageCreateManyUserInputEnvelope
    set?: StorageWhereUniqueInput | StorageWhereUniqueInput[]
    disconnect?: StorageWhereUniqueInput | StorageWhereUniqueInput[]
    delete?: StorageWhereUniqueInput | StorageWhereUniqueInput[]
    connect?: StorageWhereUniqueInput | StorageWhereUniqueInput[]
    update?: StorageUpdateWithWhereUniqueWithoutUserInput | StorageUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: StorageUpdateManyWithWhereWithoutUserInput | StorageUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: StorageScalarWhereInput | StorageScalarWhereInput[]
  }

  export type CustomerBotsUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<CustomerBotsCreateWithoutUserInput, CustomerBotsUncheckedCreateWithoutUserInput> | CustomerBotsCreateWithoutUserInput[] | CustomerBotsUncheckedCreateWithoutUserInput[]
    connectOrCreate?: CustomerBotsCreateOrConnectWithoutUserInput | CustomerBotsCreateOrConnectWithoutUserInput[]
    upsert?: CustomerBotsUpsertWithWhereUniqueWithoutUserInput | CustomerBotsUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: CustomerBotsCreateManyUserInputEnvelope
    set?: CustomerBotsWhereUniqueInput | CustomerBotsWhereUniqueInput[]
    disconnect?: CustomerBotsWhereUniqueInput | CustomerBotsWhereUniqueInput[]
    delete?: CustomerBotsWhereUniqueInput | CustomerBotsWhereUniqueInput[]
    connect?: CustomerBotsWhereUniqueInput | CustomerBotsWhereUniqueInput[]
    update?: CustomerBotsUpdateWithWhereUniqueWithoutUserInput | CustomerBotsUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: CustomerBotsUpdateManyWithWhereWithoutUserInput | CustomerBotsUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: CustomerBotsScalarWhereInput | CustomerBotsScalarWhereInput[]
  }

  export type QuotaUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<QuotaCreateWithoutUserInput, QuotaUncheckedCreateWithoutUserInput> | QuotaCreateWithoutUserInput[] | QuotaUncheckedCreateWithoutUserInput[]
    connectOrCreate?: QuotaCreateOrConnectWithoutUserInput | QuotaCreateOrConnectWithoutUserInput[]
    upsert?: QuotaUpsertWithWhereUniqueWithoutUserInput | QuotaUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: QuotaCreateManyUserInputEnvelope
    set?: QuotaWhereUniqueInput | QuotaWhereUniqueInput[]
    disconnect?: QuotaWhereUniqueInput | QuotaWhereUniqueInput[]
    delete?: QuotaWhereUniqueInput | QuotaWhereUniqueInput[]
    connect?: QuotaWhereUniqueInput | QuotaWhereUniqueInput[]
    update?: QuotaUpdateWithWhereUniqueWithoutUserInput | QuotaUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: QuotaUpdateManyWithWhereWithoutUserInput | QuotaUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: QuotaScalarWhereInput | QuotaScalarWhereInput[]
  }

  export type CustomerChatsUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<CustomerChatsCreateWithoutUserInput, CustomerChatsUncheckedCreateWithoutUserInput> | CustomerChatsCreateWithoutUserInput[] | CustomerChatsUncheckedCreateWithoutUserInput[]
    connectOrCreate?: CustomerChatsCreateOrConnectWithoutUserInput | CustomerChatsCreateOrConnectWithoutUserInput[]
    upsert?: CustomerChatsUpsertWithWhereUniqueWithoutUserInput | CustomerChatsUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: CustomerChatsCreateManyUserInputEnvelope
    set?: CustomerChatsWhereUniqueInput | CustomerChatsWhereUniqueInput[]
    disconnect?: CustomerChatsWhereUniqueInput | CustomerChatsWhereUniqueInput[]
    delete?: CustomerChatsWhereUniqueInput | CustomerChatsWhereUniqueInput[]
    connect?: CustomerChatsWhereUniqueInput | CustomerChatsWhereUniqueInput[]
    update?: CustomerChatsUpdateWithWhereUniqueWithoutUserInput | CustomerChatsUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: CustomerChatsUpdateManyWithWhereWithoutUserInput | CustomerChatsUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: CustomerChatsScalarWhereInput | CustomerChatsScalarWhereInput[]
  }

  export type ContentUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<ContentCreateWithoutUserInput, ContentUncheckedCreateWithoutUserInput> | ContentCreateWithoutUserInput[] | ContentUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ContentCreateOrConnectWithoutUserInput | ContentCreateOrConnectWithoutUserInput[]
    upsert?: ContentUpsertWithWhereUniqueWithoutUserInput | ContentUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: ContentCreateManyUserInputEnvelope
    set?: ContentWhereUniqueInput | ContentWhereUniqueInput[]
    disconnect?: ContentWhereUniqueInput | ContentWhereUniqueInput[]
    delete?: ContentWhereUniqueInput | ContentWhereUniqueInput[]
    connect?: ContentWhereUniqueInput | ContentWhereUniqueInput[]
    update?: ContentUpdateWithWhereUniqueWithoutUserInput | ContentUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: ContentUpdateManyWithWhereWithoutUserInput | ContentUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: ContentScalarWhereInput | ContentScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutQuotaInput = {
    create?: XOR<UserCreateWithoutQuotaInput, UserUncheckedCreateWithoutQuotaInput>
    connectOrCreate?: UserCreateOrConnectWithoutQuotaInput
    connect?: UserWhereUniqueInput
  }

  export type NullableEnumQuotaTypeFieldUpdateOperationsInput = {
    set?: $Enums.QuotaType | null
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type UserUpdateOneRequiredWithoutQuotaNestedInput = {
    create?: XOR<UserCreateWithoutQuotaInput, UserUncheckedCreateWithoutQuotaInput>
    connectOrCreate?: UserCreateOrConnectWithoutQuotaInput
    upsert?: UserUpsertWithoutQuotaInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutQuotaInput, UserUpdateWithoutQuotaInput>, UserUncheckedUpdateWithoutQuotaInput>
  }

  export type UserCreateNestedOneWithoutStorageInput = {
    create?: XOR<UserCreateWithoutStorageInput, UserUncheckedCreateWithoutStorageInput>
    connectOrCreate?: UserCreateOrConnectWithoutStorageInput
    connect?: UserWhereUniqueInput
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type UserUpdateOneRequiredWithoutStorageNestedInput = {
    create?: XOR<UserCreateWithoutStorageInput, UserUncheckedCreateWithoutStorageInput>
    connectOrCreate?: UserCreateOrConnectWithoutStorageInput
    upsert?: UserUpsertWithoutStorageInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutStorageInput, UserUpdateWithoutStorageInput>, UserUncheckedUpdateWithoutStorageInput>
  }

  export type UserCreateNestedOneWithoutContentInput = {
    create?: XOR<UserCreateWithoutContentInput, UserUncheckedCreateWithoutContentInput>
    connectOrCreate?: UserCreateOrConnectWithoutContentInput
    connect?: UserWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutContentNestedInput = {
    create?: XOR<UserCreateWithoutContentInput, UserUncheckedCreateWithoutContentInput>
    connectOrCreate?: UserCreateOrConnectWithoutContentInput
    upsert?: UserUpsertWithoutContentInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutContentInput, UserUpdateWithoutContentInput>, UserUncheckedUpdateWithoutContentInput>
  }

  export type UserCreateNestedOneWithoutCustomerBotsInput = {
    create?: XOR<UserCreateWithoutCustomerBotsInput, UserUncheckedCreateWithoutCustomerBotsInput>
    connectOrCreate?: UserCreateOrConnectWithoutCustomerBotsInput
    connect?: UserWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutCustomerBotsNestedInput = {
    create?: XOR<UserCreateWithoutCustomerBotsInput, UserUncheckedCreateWithoutCustomerBotsInput>
    connectOrCreate?: UserCreateOrConnectWithoutCustomerBotsInput
    upsert?: UserUpsertWithoutCustomerBotsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutCustomerBotsInput, UserUpdateWithoutCustomerBotsInput>, UserUncheckedUpdateWithoutCustomerBotsInput>
  }

  export type UserCreateNestedOneWithoutCustomerChatsInput = {
    create?: XOR<UserCreateWithoutCustomerChatsInput, UserUncheckedCreateWithoutCustomerChatsInput>
    connectOrCreate?: UserCreateOrConnectWithoutCustomerChatsInput
    connect?: UserWhereUniqueInput
  }

  export type CustomerChatDetailsCreateNestedManyWithoutChatInput = {
    create?: XOR<CustomerChatDetailsCreateWithoutChatInput, CustomerChatDetailsUncheckedCreateWithoutChatInput> | CustomerChatDetailsCreateWithoutChatInput[] | CustomerChatDetailsUncheckedCreateWithoutChatInput[]
    connectOrCreate?: CustomerChatDetailsCreateOrConnectWithoutChatInput | CustomerChatDetailsCreateOrConnectWithoutChatInput[]
    createMany?: CustomerChatDetailsCreateManyChatInputEnvelope
    connect?: CustomerChatDetailsWhereUniqueInput | CustomerChatDetailsWhereUniqueInput[]
  }

  export type GeoLocationCreateNestedManyWithoutChatInput = {
    create?: XOR<GeoLocationCreateWithoutChatInput, GeoLocationUncheckedCreateWithoutChatInput> | GeoLocationCreateWithoutChatInput[] | GeoLocationUncheckedCreateWithoutChatInput[]
    connectOrCreate?: GeoLocationCreateOrConnectWithoutChatInput | GeoLocationCreateOrConnectWithoutChatInput[]
    createMany?: GeoLocationCreateManyChatInputEnvelope
    connect?: GeoLocationWhereUniqueInput | GeoLocationWhereUniqueInput[]
  }

  export type CustomerChatDetailsUncheckedCreateNestedManyWithoutChatInput = {
    create?: XOR<CustomerChatDetailsCreateWithoutChatInput, CustomerChatDetailsUncheckedCreateWithoutChatInput> | CustomerChatDetailsCreateWithoutChatInput[] | CustomerChatDetailsUncheckedCreateWithoutChatInput[]
    connectOrCreate?: CustomerChatDetailsCreateOrConnectWithoutChatInput | CustomerChatDetailsCreateOrConnectWithoutChatInput[]
    createMany?: CustomerChatDetailsCreateManyChatInputEnvelope
    connect?: CustomerChatDetailsWhereUniqueInput | CustomerChatDetailsWhereUniqueInput[]
  }

  export type GeoLocationUncheckedCreateNestedManyWithoutChatInput = {
    create?: XOR<GeoLocationCreateWithoutChatInput, GeoLocationUncheckedCreateWithoutChatInput> | GeoLocationCreateWithoutChatInput[] | GeoLocationUncheckedCreateWithoutChatInput[]
    connectOrCreate?: GeoLocationCreateOrConnectWithoutChatInput | GeoLocationCreateOrConnectWithoutChatInput[]
    createMany?: GeoLocationCreateManyChatInputEnvelope
    connect?: GeoLocationWhereUniqueInput | GeoLocationWhereUniqueInput[]
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type UserUpdateOneRequiredWithoutCustomerChatsNestedInput = {
    create?: XOR<UserCreateWithoutCustomerChatsInput, UserUncheckedCreateWithoutCustomerChatsInput>
    connectOrCreate?: UserCreateOrConnectWithoutCustomerChatsInput
    upsert?: UserUpsertWithoutCustomerChatsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutCustomerChatsInput, UserUpdateWithoutCustomerChatsInput>, UserUncheckedUpdateWithoutCustomerChatsInput>
  }

  export type CustomerChatDetailsUpdateManyWithoutChatNestedInput = {
    create?: XOR<CustomerChatDetailsCreateWithoutChatInput, CustomerChatDetailsUncheckedCreateWithoutChatInput> | CustomerChatDetailsCreateWithoutChatInput[] | CustomerChatDetailsUncheckedCreateWithoutChatInput[]
    connectOrCreate?: CustomerChatDetailsCreateOrConnectWithoutChatInput | CustomerChatDetailsCreateOrConnectWithoutChatInput[]
    upsert?: CustomerChatDetailsUpsertWithWhereUniqueWithoutChatInput | CustomerChatDetailsUpsertWithWhereUniqueWithoutChatInput[]
    createMany?: CustomerChatDetailsCreateManyChatInputEnvelope
    set?: CustomerChatDetailsWhereUniqueInput | CustomerChatDetailsWhereUniqueInput[]
    disconnect?: CustomerChatDetailsWhereUniqueInput | CustomerChatDetailsWhereUniqueInput[]
    delete?: CustomerChatDetailsWhereUniqueInput | CustomerChatDetailsWhereUniqueInput[]
    connect?: CustomerChatDetailsWhereUniqueInput | CustomerChatDetailsWhereUniqueInput[]
    update?: CustomerChatDetailsUpdateWithWhereUniqueWithoutChatInput | CustomerChatDetailsUpdateWithWhereUniqueWithoutChatInput[]
    updateMany?: CustomerChatDetailsUpdateManyWithWhereWithoutChatInput | CustomerChatDetailsUpdateManyWithWhereWithoutChatInput[]
    deleteMany?: CustomerChatDetailsScalarWhereInput | CustomerChatDetailsScalarWhereInput[]
  }

  export type GeoLocationUpdateManyWithoutChatNestedInput = {
    create?: XOR<GeoLocationCreateWithoutChatInput, GeoLocationUncheckedCreateWithoutChatInput> | GeoLocationCreateWithoutChatInput[] | GeoLocationUncheckedCreateWithoutChatInput[]
    connectOrCreate?: GeoLocationCreateOrConnectWithoutChatInput | GeoLocationCreateOrConnectWithoutChatInput[]
    upsert?: GeoLocationUpsertWithWhereUniqueWithoutChatInput | GeoLocationUpsertWithWhereUniqueWithoutChatInput[]
    createMany?: GeoLocationCreateManyChatInputEnvelope
    set?: GeoLocationWhereUniqueInput | GeoLocationWhereUniqueInput[]
    disconnect?: GeoLocationWhereUniqueInput | GeoLocationWhereUniqueInput[]
    delete?: GeoLocationWhereUniqueInput | GeoLocationWhereUniqueInput[]
    connect?: GeoLocationWhereUniqueInput | GeoLocationWhereUniqueInput[]
    update?: GeoLocationUpdateWithWhereUniqueWithoutChatInput | GeoLocationUpdateWithWhereUniqueWithoutChatInput[]
    updateMany?: GeoLocationUpdateManyWithWhereWithoutChatInput | GeoLocationUpdateManyWithWhereWithoutChatInput[]
    deleteMany?: GeoLocationScalarWhereInput | GeoLocationScalarWhereInput[]
  }

  export type CustomerChatDetailsUncheckedUpdateManyWithoutChatNestedInput = {
    create?: XOR<CustomerChatDetailsCreateWithoutChatInput, CustomerChatDetailsUncheckedCreateWithoutChatInput> | CustomerChatDetailsCreateWithoutChatInput[] | CustomerChatDetailsUncheckedCreateWithoutChatInput[]
    connectOrCreate?: CustomerChatDetailsCreateOrConnectWithoutChatInput | CustomerChatDetailsCreateOrConnectWithoutChatInput[]
    upsert?: CustomerChatDetailsUpsertWithWhereUniqueWithoutChatInput | CustomerChatDetailsUpsertWithWhereUniqueWithoutChatInput[]
    createMany?: CustomerChatDetailsCreateManyChatInputEnvelope
    set?: CustomerChatDetailsWhereUniqueInput | CustomerChatDetailsWhereUniqueInput[]
    disconnect?: CustomerChatDetailsWhereUniqueInput | CustomerChatDetailsWhereUniqueInput[]
    delete?: CustomerChatDetailsWhereUniqueInput | CustomerChatDetailsWhereUniqueInput[]
    connect?: CustomerChatDetailsWhereUniqueInput | CustomerChatDetailsWhereUniqueInput[]
    update?: CustomerChatDetailsUpdateWithWhereUniqueWithoutChatInput | CustomerChatDetailsUpdateWithWhereUniqueWithoutChatInput[]
    updateMany?: CustomerChatDetailsUpdateManyWithWhereWithoutChatInput | CustomerChatDetailsUpdateManyWithWhereWithoutChatInput[]
    deleteMany?: CustomerChatDetailsScalarWhereInput | CustomerChatDetailsScalarWhereInput[]
  }

  export type GeoLocationUncheckedUpdateManyWithoutChatNestedInput = {
    create?: XOR<GeoLocationCreateWithoutChatInput, GeoLocationUncheckedCreateWithoutChatInput> | GeoLocationCreateWithoutChatInput[] | GeoLocationUncheckedCreateWithoutChatInput[]
    connectOrCreate?: GeoLocationCreateOrConnectWithoutChatInput | GeoLocationCreateOrConnectWithoutChatInput[]
    upsert?: GeoLocationUpsertWithWhereUniqueWithoutChatInput | GeoLocationUpsertWithWhereUniqueWithoutChatInput[]
    createMany?: GeoLocationCreateManyChatInputEnvelope
    set?: GeoLocationWhereUniqueInput | GeoLocationWhereUniqueInput[]
    disconnect?: GeoLocationWhereUniqueInput | GeoLocationWhereUniqueInput[]
    delete?: GeoLocationWhereUniqueInput | GeoLocationWhereUniqueInput[]
    connect?: GeoLocationWhereUniqueInput | GeoLocationWhereUniqueInput[]
    update?: GeoLocationUpdateWithWhereUniqueWithoutChatInput | GeoLocationUpdateWithWhereUniqueWithoutChatInput[]
    updateMany?: GeoLocationUpdateManyWithWhereWithoutChatInput | GeoLocationUpdateManyWithWhereWithoutChatInput[]
    deleteMany?: GeoLocationScalarWhereInput | GeoLocationScalarWhereInput[]
  }

  export type CustomerChatsCreateNestedOneWithoutCustomerChatDetailsInput = {
    create?: XOR<CustomerChatsCreateWithoutCustomerChatDetailsInput, CustomerChatsUncheckedCreateWithoutCustomerChatDetailsInput>
    connectOrCreate?: CustomerChatsCreateOrConnectWithoutCustomerChatDetailsInput
    connect?: CustomerChatsWhereUniqueInput
  }

  export type CustomerChatsUpdateOneRequiredWithoutCustomerChatDetailsNestedInput = {
    create?: XOR<CustomerChatsCreateWithoutCustomerChatDetailsInput, CustomerChatsUncheckedCreateWithoutCustomerChatDetailsInput>
    connectOrCreate?: CustomerChatsCreateOrConnectWithoutCustomerChatDetailsInput
    upsert?: CustomerChatsUpsertWithoutCustomerChatDetailsInput
    connect?: CustomerChatsWhereUniqueInput
    update?: XOR<XOR<CustomerChatsUpdateToOneWithWhereWithoutCustomerChatDetailsInput, CustomerChatsUpdateWithoutCustomerChatDetailsInput>, CustomerChatsUncheckedUpdateWithoutCustomerChatDetailsInput>
  }

  export type CustomerChatsCreateNestedOneWithoutGeoLocationInput = {
    create?: XOR<CustomerChatsCreateWithoutGeoLocationInput, CustomerChatsUncheckedCreateWithoutGeoLocationInput>
    connectOrCreate?: CustomerChatsCreateOrConnectWithoutGeoLocationInput
    connect?: CustomerChatsWhereUniqueInput
  }

  export type FloatFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type CustomerChatsUpdateOneRequiredWithoutGeoLocationNestedInput = {
    create?: XOR<CustomerChatsCreateWithoutGeoLocationInput, CustomerChatsUncheckedCreateWithoutGeoLocationInput>
    connectOrCreate?: CustomerChatsCreateOrConnectWithoutGeoLocationInput
    upsert?: CustomerChatsUpsertWithoutGeoLocationInput
    connect?: CustomerChatsWhereUniqueInput
    update?: XOR<XOR<CustomerChatsUpdateToOneWithWhereWithoutGeoLocationInput, CustomerChatsUpdateWithoutGeoLocationInput>, CustomerChatsUncheckedUpdateWithoutGeoLocationInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedEnumQuotaTypeNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.QuotaType | EnumQuotaTypeFieldRefInput<$PrismaModel> | null
    in?: $Enums.QuotaType[] | ListEnumQuotaTypeFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.QuotaType[] | ListEnumQuotaTypeFieldRefInput<$PrismaModel> | null
    not?: NestedEnumQuotaTypeNullableFilter<$PrismaModel> | $Enums.QuotaType | null
  }

  export type NestedEnumQuotaTypeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.QuotaType | EnumQuotaTypeFieldRefInput<$PrismaModel> | null
    in?: $Enums.QuotaType[] | ListEnumQuotaTypeFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.QuotaType[] | ListEnumQuotaTypeFieldRefInput<$PrismaModel> | null
    not?: NestedEnumQuotaTypeNullableWithAggregatesFilter<$PrismaModel> | $Enums.QuotaType | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumQuotaTypeNullableFilter<$PrismaModel>
    _max?: NestedEnumQuotaTypeNullableFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedFloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type StorageCreateWithoutUserInput = {
    id?: string
    botId: string
    fileName: string
    fileUrl: string
    type: string
    size: string
    status: string
    taskId: string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    isDeleted?: boolean
  }

  export type StorageUncheckedCreateWithoutUserInput = {
    id?: string
    botId: string
    fileName: string
    fileUrl: string
    type: string
    size: string
    status: string
    taskId: string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    isDeleted?: boolean
  }

  export type StorageCreateOrConnectWithoutUserInput = {
    where: StorageWhereUniqueInput
    create: XOR<StorageCreateWithoutUserInput, StorageUncheckedCreateWithoutUserInput>
  }

  export type StorageCreateManyUserInputEnvelope = {
    data: StorageCreateManyUserInput | StorageCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type CustomerBotsCreateWithoutUserInput = {
    id?: string
    botName: string
    botAvatar: string
    systemPrompt?: string
    settings?: NullableJsonNullValueInput | InputJsonValue
    active?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    isDeleted?: boolean
    deletedAt?: Date | string | null
  }

  export type CustomerBotsUncheckedCreateWithoutUserInput = {
    id?: string
    botName: string
    botAvatar: string
    systemPrompt?: string
    settings?: NullableJsonNullValueInput | InputJsonValue
    active?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    isDeleted?: boolean
    deletedAt?: Date | string | null
  }

  export type CustomerBotsCreateOrConnectWithoutUserInput = {
    where: CustomerBotsWhereUniqueInput
    create: XOR<CustomerBotsCreateWithoutUserInput, CustomerBotsUncheckedCreateWithoutUserInput>
  }

  export type CustomerBotsCreateManyUserInputEnvelope = {
    data: CustomerBotsCreateManyUserInput | CustomerBotsCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type QuotaCreateWithoutUserInput = {
    id?: string
    quotaType?: $Enums.QuotaType | null
    limit?: number
    used?: number
  }

  export type QuotaUncheckedCreateWithoutUserInput = {
    id?: string
    quotaType?: $Enums.QuotaType | null
    limit?: number
    used?: number
  }

  export type QuotaCreateOrConnectWithoutUserInput = {
    where: QuotaWhereUniqueInput
    create: XOR<QuotaCreateWithoutUserInput, QuotaUncheckedCreateWithoutUserInput>
  }

  export type QuotaCreateManyUserInputEnvelope = {
    data: QuotaCreateManyUserInput | QuotaCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type CustomerChatsCreateWithoutUserInput = {
    id?: string
    botId: string
    chatId: string
    createdAt?: Date | string
    updatedAt?: Date | string
    isDeleted?: boolean
    deletedAt?: Date | string | null
    totalTokens?: number | null
    CustomerChatDetails?: CustomerChatDetailsCreateNestedManyWithoutChatInput
    GeoLocation?: GeoLocationCreateNestedManyWithoutChatInput
  }

  export type CustomerChatsUncheckedCreateWithoutUserInput = {
    id?: string
    botId: string
    chatId: string
    createdAt?: Date | string
    updatedAt?: Date | string
    isDeleted?: boolean
    deletedAt?: Date | string | null
    totalTokens?: number | null
    CustomerChatDetails?: CustomerChatDetailsUncheckedCreateNestedManyWithoutChatInput
    GeoLocation?: GeoLocationUncheckedCreateNestedManyWithoutChatInput
  }

  export type CustomerChatsCreateOrConnectWithoutUserInput = {
    where: CustomerChatsWhereUniqueInput
    create: XOR<CustomerChatsCreateWithoutUserInput, CustomerChatsUncheckedCreateWithoutUserInput>
  }

  export type CustomerChatsCreateManyUserInputEnvelope = {
    data: CustomerChatsCreateManyUserInput | CustomerChatsCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type ContentCreateWithoutUserInput = {
    id?: string
    botId: string
    content?: NullableJsonNullValueInput | InputJsonValue
    type: string
    status: string
    taskId: string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    isDeleted?: boolean
  }

  export type ContentUncheckedCreateWithoutUserInput = {
    id?: string
    botId: string
    content?: NullableJsonNullValueInput | InputJsonValue
    type: string
    status: string
    taskId: string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    isDeleted?: boolean
  }

  export type ContentCreateOrConnectWithoutUserInput = {
    where: ContentWhereUniqueInput
    create: XOR<ContentCreateWithoutUserInput, ContentUncheckedCreateWithoutUserInput>
  }

  export type ContentCreateManyUserInputEnvelope = {
    data: ContentCreateManyUserInput | ContentCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type StorageUpsertWithWhereUniqueWithoutUserInput = {
    where: StorageWhereUniqueInput
    update: XOR<StorageUpdateWithoutUserInput, StorageUncheckedUpdateWithoutUserInput>
    create: XOR<StorageCreateWithoutUserInput, StorageUncheckedCreateWithoutUserInput>
  }

  export type StorageUpdateWithWhereUniqueWithoutUserInput = {
    where: StorageWhereUniqueInput
    data: XOR<StorageUpdateWithoutUserInput, StorageUncheckedUpdateWithoutUserInput>
  }

  export type StorageUpdateManyWithWhereWithoutUserInput = {
    where: StorageScalarWhereInput
    data: XOR<StorageUpdateManyMutationInput, StorageUncheckedUpdateManyWithoutUserInput>
  }

  export type StorageScalarWhereInput = {
    AND?: StorageScalarWhereInput | StorageScalarWhereInput[]
    OR?: StorageScalarWhereInput[]
    NOT?: StorageScalarWhereInput | StorageScalarWhereInput[]
    id?: StringFilter<"Storage"> | string
    userId?: StringFilter<"Storage"> | string
    botId?: StringFilter<"Storage"> | string
    fileName?: StringFilter<"Storage"> | string
    fileUrl?: StringFilter<"Storage"> | string
    type?: StringFilter<"Storage"> | string
    size?: StringFilter<"Storage"> | string
    status?: StringFilter<"Storage"> | string
    taskId?: StringFilter<"Storage"> | string
    ingestionInfo?: JsonNullableFilter<"Storage">
    createdAt?: DateTimeFilter<"Storage"> | Date | string
    updatedAt?: DateTimeFilter<"Storage"> | Date | string
    deletedAt?: DateTimeNullableFilter<"Storage"> | Date | string | null
    isDeleted?: BoolFilter<"Storage"> | boolean
  }

  export type CustomerBotsUpsertWithWhereUniqueWithoutUserInput = {
    where: CustomerBotsWhereUniqueInput
    update: XOR<CustomerBotsUpdateWithoutUserInput, CustomerBotsUncheckedUpdateWithoutUserInput>
    create: XOR<CustomerBotsCreateWithoutUserInput, CustomerBotsUncheckedCreateWithoutUserInput>
  }

  export type CustomerBotsUpdateWithWhereUniqueWithoutUserInput = {
    where: CustomerBotsWhereUniqueInput
    data: XOR<CustomerBotsUpdateWithoutUserInput, CustomerBotsUncheckedUpdateWithoutUserInput>
  }

  export type CustomerBotsUpdateManyWithWhereWithoutUserInput = {
    where: CustomerBotsScalarWhereInput
    data: XOR<CustomerBotsUpdateManyMutationInput, CustomerBotsUncheckedUpdateManyWithoutUserInput>
  }

  export type CustomerBotsScalarWhereInput = {
    AND?: CustomerBotsScalarWhereInput | CustomerBotsScalarWhereInput[]
    OR?: CustomerBotsScalarWhereInput[]
    NOT?: CustomerBotsScalarWhereInput | CustomerBotsScalarWhereInput[]
    id?: StringFilter<"CustomerBots"> | string
    userId?: StringFilter<"CustomerBots"> | string
    botName?: StringFilter<"CustomerBots"> | string
    botAvatar?: StringFilter<"CustomerBots"> | string
    systemPrompt?: StringFilter<"CustomerBots"> | string
    settings?: JsonNullableFilter<"CustomerBots">
    active?: BoolFilter<"CustomerBots"> | boolean
    createdAt?: DateTimeFilter<"CustomerBots"> | Date | string
    updatedAt?: DateTimeFilter<"CustomerBots"> | Date | string
    isDeleted?: BoolFilter<"CustomerBots"> | boolean
    deletedAt?: DateTimeNullableFilter<"CustomerBots"> | Date | string | null
  }

  export type QuotaUpsertWithWhereUniqueWithoutUserInput = {
    where: QuotaWhereUniqueInput
    update: XOR<QuotaUpdateWithoutUserInput, QuotaUncheckedUpdateWithoutUserInput>
    create: XOR<QuotaCreateWithoutUserInput, QuotaUncheckedCreateWithoutUserInput>
  }

  export type QuotaUpdateWithWhereUniqueWithoutUserInput = {
    where: QuotaWhereUniqueInput
    data: XOR<QuotaUpdateWithoutUserInput, QuotaUncheckedUpdateWithoutUserInput>
  }

  export type QuotaUpdateManyWithWhereWithoutUserInput = {
    where: QuotaScalarWhereInput
    data: XOR<QuotaUpdateManyMutationInput, QuotaUncheckedUpdateManyWithoutUserInput>
  }

  export type QuotaScalarWhereInput = {
    AND?: QuotaScalarWhereInput | QuotaScalarWhereInput[]
    OR?: QuotaScalarWhereInput[]
    NOT?: QuotaScalarWhereInput | QuotaScalarWhereInput[]
    id?: StringFilter<"Quota"> | string
    userId?: StringFilter<"Quota"> | string
    quotaType?: EnumQuotaTypeNullableFilter<"Quota"> | $Enums.QuotaType | null
    limit?: IntFilter<"Quota"> | number
    used?: IntFilter<"Quota"> | number
  }

  export type CustomerChatsUpsertWithWhereUniqueWithoutUserInput = {
    where: CustomerChatsWhereUniqueInput
    update: XOR<CustomerChatsUpdateWithoutUserInput, CustomerChatsUncheckedUpdateWithoutUserInput>
    create: XOR<CustomerChatsCreateWithoutUserInput, CustomerChatsUncheckedCreateWithoutUserInput>
  }

  export type CustomerChatsUpdateWithWhereUniqueWithoutUserInput = {
    where: CustomerChatsWhereUniqueInput
    data: XOR<CustomerChatsUpdateWithoutUserInput, CustomerChatsUncheckedUpdateWithoutUserInput>
  }

  export type CustomerChatsUpdateManyWithWhereWithoutUserInput = {
    where: CustomerChatsScalarWhereInput
    data: XOR<CustomerChatsUpdateManyMutationInput, CustomerChatsUncheckedUpdateManyWithoutUserInput>
  }

  export type CustomerChatsScalarWhereInput = {
    AND?: CustomerChatsScalarWhereInput | CustomerChatsScalarWhereInput[]
    OR?: CustomerChatsScalarWhereInput[]
    NOT?: CustomerChatsScalarWhereInput | CustomerChatsScalarWhereInput[]
    id?: StringFilter<"CustomerChats"> | string
    userId?: StringFilter<"CustomerChats"> | string
    botId?: StringFilter<"CustomerChats"> | string
    chatId?: StringFilter<"CustomerChats"> | string
    createdAt?: DateTimeFilter<"CustomerChats"> | Date | string
    updatedAt?: DateTimeFilter<"CustomerChats"> | Date | string
    isDeleted?: BoolFilter<"CustomerChats"> | boolean
    deletedAt?: DateTimeNullableFilter<"CustomerChats"> | Date | string | null
    totalTokens?: IntNullableFilter<"CustomerChats"> | number | null
  }

  export type ContentUpsertWithWhereUniqueWithoutUserInput = {
    where: ContentWhereUniqueInput
    update: XOR<ContentUpdateWithoutUserInput, ContentUncheckedUpdateWithoutUserInput>
    create: XOR<ContentCreateWithoutUserInput, ContentUncheckedCreateWithoutUserInput>
  }

  export type ContentUpdateWithWhereUniqueWithoutUserInput = {
    where: ContentWhereUniqueInput
    data: XOR<ContentUpdateWithoutUserInput, ContentUncheckedUpdateWithoutUserInput>
  }

  export type ContentUpdateManyWithWhereWithoutUserInput = {
    where: ContentScalarWhereInput
    data: XOR<ContentUpdateManyMutationInput, ContentUncheckedUpdateManyWithoutUserInput>
  }

  export type ContentScalarWhereInput = {
    AND?: ContentScalarWhereInput | ContentScalarWhereInput[]
    OR?: ContentScalarWhereInput[]
    NOT?: ContentScalarWhereInput | ContentScalarWhereInput[]
    id?: StringFilter<"Content"> | string
    userId?: StringFilter<"Content"> | string
    botId?: StringFilter<"Content"> | string
    content?: JsonNullableFilter<"Content">
    type?: StringFilter<"Content"> | string
    status?: StringFilter<"Content"> | string
    taskId?: StringFilter<"Content"> | string
    ingestionInfo?: JsonNullableFilter<"Content">
    createdAt?: DateTimeFilter<"Content"> | Date | string
    updatedAt?: DateTimeFilter<"Content"> | Date | string
    deletedAt?: DateTimeNullableFilter<"Content"> | Date | string | null
    isDeleted?: BoolFilter<"Content"> | boolean
  }

  export type UserCreateWithoutQuotaInput = {
    id?: string
    name: string
    email: string
    phonenumber?: string | null
    password: string
    refreshToken?: string | null
    emailVerified?: boolean
    phoneVerified?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    Storage?: StorageCreateNestedManyWithoutUserInput
    CustomerBots?: CustomerBotsCreateNestedManyWithoutUserInput
    CustomerChats?: CustomerChatsCreateNestedManyWithoutUserInput
    Content?: ContentCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutQuotaInput = {
    id?: string
    name: string
    email: string
    phonenumber?: string | null
    password: string
    refreshToken?: string | null
    emailVerified?: boolean
    phoneVerified?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    Storage?: StorageUncheckedCreateNestedManyWithoutUserInput
    CustomerBots?: CustomerBotsUncheckedCreateNestedManyWithoutUserInput
    CustomerChats?: CustomerChatsUncheckedCreateNestedManyWithoutUserInput
    Content?: ContentUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutQuotaInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutQuotaInput, UserUncheckedCreateWithoutQuotaInput>
  }

  export type UserUpsertWithoutQuotaInput = {
    update: XOR<UserUpdateWithoutQuotaInput, UserUncheckedUpdateWithoutQuotaInput>
    create: XOR<UserCreateWithoutQuotaInput, UserUncheckedCreateWithoutQuotaInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutQuotaInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutQuotaInput, UserUncheckedUpdateWithoutQuotaInput>
  }

  export type UserUpdateWithoutQuotaInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phonenumber?: NullableStringFieldUpdateOperationsInput | string | null
    password?: StringFieldUpdateOperationsInput | string
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    phoneVerified?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    Storage?: StorageUpdateManyWithoutUserNestedInput
    CustomerBots?: CustomerBotsUpdateManyWithoutUserNestedInput
    CustomerChats?: CustomerChatsUpdateManyWithoutUserNestedInput
    Content?: ContentUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutQuotaInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phonenumber?: NullableStringFieldUpdateOperationsInput | string | null
    password?: StringFieldUpdateOperationsInput | string
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    phoneVerified?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    Storage?: StorageUncheckedUpdateManyWithoutUserNestedInput
    CustomerBots?: CustomerBotsUncheckedUpdateManyWithoutUserNestedInput
    CustomerChats?: CustomerChatsUncheckedUpdateManyWithoutUserNestedInput
    Content?: ContentUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateWithoutStorageInput = {
    id?: string
    name: string
    email: string
    phonenumber?: string | null
    password: string
    refreshToken?: string | null
    emailVerified?: boolean
    phoneVerified?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    CustomerBots?: CustomerBotsCreateNestedManyWithoutUserInput
    Quota?: QuotaCreateNestedManyWithoutUserInput
    CustomerChats?: CustomerChatsCreateNestedManyWithoutUserInput
    Content?: ContentCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutStorageInput = {
    id?: string
    name: string
    email: string
    phonenumber?: string | null
    password: string
    refreshToken?: string | null
    emailVerified?: boolean
    phoneVerified?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    CustomerBots?: CustomerBotsUncheckedCreateNestedManyWithoutUserInput
    Quota?: QuotaUncheckedCreateNestedManyWithoutUserInput
    CustomerChats?: CustomerChatsUncheckedCreateNestedManyWithoutUserInput
    Content?: ContentUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutStorageInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutStorageInput, UserUncheckedCreateWithoutStorageInput>
  }

  export type UserUpsertWithoutStorageInput = {
    update: XOR<UserUpdateWithoutStorageInput, UserUncheckedUpdateWithoutStorageInput>
    create: XOR<UserCreateWithoutStorageInput, UserUncheckedCreateWithoutStorageInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutStorageInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutStorageInput, UserUncheckedUpdateWithoutStorageInput>
  }

  export type UserUpdateWithoutStorageInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phonenumber?: NullableStringFieldUpdateOperationsInput | string | null
    password?: StringFieldUpdateOperationsInput | string
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    phoneVerified?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    CustomerBots?: CustomerBotsUpdateManyWithoutUserNestedInput
    Quota?: QuotaUpdateManyWithoutUserNestedInput
    CustomerChats?: CustomerChatsUpdateManyWithoutUserNestedInput
    Content?: ContentUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutStorageInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phonenumber?: NullableStringFieldUpdateOperationsInput | string | null
    password?: StringFieldUpdateOperationsInput | string
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    phoneVerified?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    CustomerBots?: CustomerBotsUncheckedUpdateManyWithoutUserNestedInput
    Quota?: QuotaUncheckedUpdateManyWithoutUserNestedInput
    CustomerChats?: CustomerChatsUncheckedUpdateManyWithoutUserNestedInput
    Content?: ContentUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateWithoutContentInput = {
    id?: string
    name: string
    email: string
    phonenumber?: string | null
    password: string
    refreshToken?: string | null
    emailVerified?: boolean
    phoneVerified?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    Storage?: StorageCreateNestedManyWithoutUserInput
    CustomerBots?: CustomerBotsCreateNestedManyWithoutUserInput
    Quota?: QuotaCreateNestedManyWithoutUserInput
    CustomerChats?: CustomerChatsCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutContentInput = {
    id?: string
    name: string
    email: string
    phonenumber?: string | null
    password: string
    refreshToken?: string | null
    emailVerified?: boolean
    phoneVerified?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    Storage?: StorageUncheckedCreateNestedManyWithoutUserInput
    CustomerBots?: CustomerBotsUncheckedCreateNestedManyWithoutUserInput
    Quota?: QuotaUncheckedCreateNestedManyWithoutUserInput
    CustomerChats?: CustomerChatsUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutContentInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutContentInput, UserUncheckedCreateWithoutContentInput>
  }

  export type UserUpsertWithoutContentInput = {
    update: XOR<UserUpdateWithoutContentInput, UserUncheckedUpdateWithoutContentInput>
    create: XOR<UserCreateWithoutContentInput, UserUncheckedCreateWithoutContentInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutContentInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutContentInput, UserUncheckedUpdateWithoutContentInput>
  }

  export type UserUpdateWithoutContentInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phonenumber?: NullableStringFieldUpdateOperationsInput | string | null
    password?: StringFieldUpdateOperationsInput | string
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    phoneVerified?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    Storage?: StorageUpdateManyWithoutUserNestedInput
    CustomerBots?: CustomerBotsUpdateManyWithoutUserNestedInput
    Quota?: QuotaUpdateManyWithoutUserNestedInput
    CustomerChats?: CustomerChatsUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutContentInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phonenumber?: NullableStringFieldUpdateOperationsInput | string | null
    password?: StringFieldUpdateOperationsInput | string
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    phoneVerified?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    Storage?: StorageUncheckedUpdateManyWithoutUserNestedInput
    CustomerBots?: CustomerBotsUncheckedUpdateManyWithoutUserNestedInput
    Quota?: QuotaUncheckedUpdateManyWithoutUserNestedInput
    CustomerChats?: CustomerChatsUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateWithoutCustomerBotsInput = {
    id?: string
    name: string
    email: string
    phonenumber?: string | null
    password: string
    refreshToken?: string | null
    emailVerified?: boolean
    phoneVerified?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    Storage?: StorageCreateNestedManyWithoutUserInput
    Quota?: QuotaCreateNestedManyWithoutUserInput
    CustomerChats?: CustomerChatsCreateNestedManyWithoutUserInput
    Content?: ContentCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutCustomerBotsInput = {
    id?: string
    name: string
    email: string
    phonenumber?: string | null
    password: string
    refreshToken?: string | null
    emailVerified?: boolean
    phoneVerified?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    Storage?: StorageUncheckedCreateNestedManyWithoutUserInput
    Quota?: QuotaUncheckedCreateNestedManyWithoutUserInput
    CustomerChats?: CustomerChatsUncheckedCreateNestedManyWithoutUserInput
    Content?: ContentUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutCustomerBotsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutCustomerBotsInput, UserUncheckedCreateWithoutCustomerBotsInput>
  }

  export type UserUpsertWithoutCustomerBotsInput = {
    update: XOR<UserUpdateWithoutCustomerBotsInput, UserUncheckedUpdateWithoutCustomerBotsInput>
    create: XOR<UserCreateWithoutCustomerBotsInput, UserUncheckedCreateWithoutCustomerBotsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutCustomerBotsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutCustomerBotsInput, UserUncheckedUpdateWithoutCustomerBotsInput>
  }

  export type UserUpdateWithoutCustomerBotsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phonenumber?: NullableStringFieldUpdateOperationsInput | string | null
    password?: StringFieldUpdateOperationsInput | string
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    phoneVerified?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    Storage?: StorageUpdateManyWithoutUserNestedInput
    Quota?: QuotaUpdateManyWithoutUserNestedInput
    CustomerChats?: CustomerChatsUpdateManyWithoutUserNestedInput
    Content?: ContentUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutCustomerBotsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phonenumber?: NullableStringFieldUpdateOperationsInput | string | null
    password?: StringFieldUpdateOperationsInput | string
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    phoneVerified?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    Storage?: StorageUncheckedUpdateManyWithoutUserNestedInput
    Quota?: QuotaUncheckedUpdateManyWithoutUserNestedInput
    CustomerChats?: CustomerChatsUncheckedUpdateManyWithoutUserNestedInput
    Content?: ContentUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateWithoutCustomerChatsInput = {
    id?: string
    name: string
    email: string
    phonenumber?: string | null
    password: string
    refreshToken?: string | null
    emailVerified?: boolean
    phoneVerified?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    Storage?: StorageCreateNestedManyWithoutUserInput
    CustomerBots?: CustomerBotsCreateNestedManyWithoutUserInput
    Quota?: QuotaCreateNestedManyWithoutUserInput
    Content?: ContentCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutCustomerChatsInput = {
    id?: string
    name: string
    email: string
    phonenumber?: string | null
    password: string
    refreshToken?: string | null
    emailVerified?: boolean
    phoneVerified?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    Storage?: StorageUncheckedCreateNestedManyWithoutUserInput
    CustomerBots?: CustomerBotsUncheckedCreateNestedManyWithoutUserInput
    Quota?: QuotaUncheckedCreateNestedManyWithoutUserInput
    Content?: ContentUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutCustomerChatsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutCustomerChatsInput, UserUncheckedCreateWithoutCustomerChatsInput>
  }

  export type CustomerChatDetailsCreateWithoutChatInput = {
    id?: string
    message: string
    sender: string
    tokenDetails?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type CustomerChatDetailsUncheckedCreateWithoutChatInput = {
    id?: string
    message: string
    sender: string
    tokenDetails?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type CustomerChatDetailsCreateOrConnectWithoutChatInput = {
    where: CustomerChatDetailsWhereUniqueInput
    create: XOR<CustomerChatDetailsCreateWithoutChatInput, CustomerChatDetailsUncheckedCreateWithoutChatInput>
  }

  export type CustomerChatDetailsCreateManyChatInputEnvelope = {
    data: CustomerChatDetailsCreateManyChatInput | CustomerChatDetailsCreateManyChatInput[]
    skipDuplicates?: boolean
  }

  export type GeoLocationCreateWithoutChatInput = {
    id?: string
    ip: string
    country: string
    countryCode: string
    region: string
    city: string
    timezone: string
    organization: string
    organization_name: string
    latitude: number
    longitude: number
    accuracy: number
    createdAt?: Date | string
  }

  export type GeoLocationUncheckedCreateWithoutChatInput = {
    id?: string
    ip: string
    country: string
    countryCode: string
    region: string
    city: string
    timezone: string
    organization: string
    organization_name: string
    latitude: number
    longitude: number
    accuracy: number
    createdAt?: Date | string
  }

  export type GeoLocationCreateOrConnectWithoutChatInput = {
    where: GeoLocationWhereUniqueInput
    create: XOR<GeoLocationCreateWithoutChatInput, GeoLocationUncheckedCreateWithoutChatInput>
  }

  export type GeoLocationCreateManyChatInputEnvelope = {
    data: GeoLocationCreateManyChatInput | GeoLocationCreateManyChatInput[]
    skipDuplicates?: boolean
  }

  export type UserUpsertWithoutCustomerChatsInput = {
    update: XOR<UserUpdateWithoutCustomerChatsInput, UserUncheckedUpdateWithoutCustomerChatsInput>
    create: XOR<UserCreateWithoutCustomerChatsInput, UserUncheckedCreateWithoutCustomerChatsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutCustomerChatsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutCustomerChatsInput, UserUncheckedUpdateWithoutCustomerChatsInput>
  }

  export type UserUpdateWithoutCustomerChatsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phonenumber?: NullableStringFieldUpdateOperationsInput | string | null
    password?: StringFieldUpdateOperationsInput | string
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    phoneVerified?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    Storage?: StorageUpdateManyWithoutUserNestedInput
    CustomerBots?: CustomerBotsUpdateManyWithoutUserNestedInput
    Quota?: QuotaUpdateManyWithoutUserNestedInput
    Content?: ContentUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutCustomerChatsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phonenumber?: NullableStringFieldUpdateOperationsInput | string | null
    password?: StringFieldUpdateOperationsInput | string
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    phoneVerified?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    Storage?: StorageUncheckedUpdateManyWithoutUserNestedInput
    CustomerBots?: CustomerBotsUncheckedUpdateManyWithoutUserNestedInput
    Quota?: QuotaUncheckedUpdateManyWithoutUserNestedInput
    Content?: ContentUncheckedUpdateManyWithoutUserNestedInput
  }

  export type CustomerChatDetailsUpsertWithWhereUniqueWithoutChatInput = {
    where: CustomerChatDetailsWhereUniqueInput
    update: XOR<CustomerChatDetailsUpdateWithoutChatInput, CustomerChatDetailsUncheckedUpdateWithoutChatInput>
    create: XOR<CustomerChatDetailsCreateWithoutChatInput, CustomerChatDetailsUncheckedCreateWithoutChatInput>
  }

  export type CustomerChatDetailsUpdateWithWhereUniqueWithoutChatInput = {
    where: CustomerChatDetailsWhereUniqueInput
    data: XOR<CustomerChatDetailsUpdateWithoutChatInput, CustomerChatDetailsUncheckedUpdateWithoutChatInput>
  }

  export type CustomerChatDetailsUpdateManyWithWhereWithoutChatInput = {
    where: CustomerChatDetailsScalarWhereInput
    data: XOR<CustomerChatDetailsUpdateManyMutationInput, CustomerChatDetailsUncheckedUpdateManyWithoutChatInput>
  }

  export type CustomerChatDetailsScalarWhereInput = {
    AND?: CustomerChatDetailsScalarWhereInput | CustomerChatDetailsScalarWhereInput[]
    OR?: CustomerChatDetailsScalarWhereInput[]
    NOT?: CustomerChatDetailsScalarWhereInput | CustomerChatDetailsScalarWhereInput[]
    id?: StringFilter<"CustomerChatDetails"> | string
    chatId?: StringFilter<"CustomerChatDetails"> | string
    message?: StringFilter<"CustomerChatDetails"> | string
    sender?: StringFilter<"CustomerChatDetails"> | string
    tokenDetails?: JsonNullableFilter<"CustomerChatDetails">
    createdAt?: DateTimeFilter<"CustomerChatDetails"> | Date | string
  }

  export type GeoLocationUpsertWithWhereUniqueWithoutChatInput = {
    where: GeoLocationWhereUniqueInput
    update: XOR<GeoLocationUpdateWithoutChatInput, GeoLocationUncheckedUpdateWithoutChatInput>
    create: XOR<GeoLocationCreateWithoutChatInput, GeoLocationUncheckedCreateWithoutChatInput>
  }

  export type GeoLocationUpdateWithWhereUniqueWithoutChatInput = {
    where: GeoLocationWhereUniqueInput
    data: XOR<GeoLocationUpdateWithoutChatInput, GeoLocationUncheckedUpdateWithoutChatInput>
  }

  export type GeoLocationUpdateManyWithWhereWithoutChatInput = {
    where: GeoLocationScalarWhereInput
    data: XOR<GeoLocationUpdateManyMutationInput, GeoLocationUncheckedUpdateManyWithoutChatInput>
  }

  export type GeoLocationScalarWhereInput = {
    AND?: GeoLocationScalarWhereInput | GeoLocationScalarWhereInput[]
    OR?: GeoLocationScalarWhereInput[]
    NOT?: GeoLocationScalarWhereInput | GeoLocationScalarWhereInput[]
    id?: StringFilter<"GeoLocation"> | string
    chatId?: StringFilter<"GeoLocation"> | string
    ip?: StringFilter<"GeoLocation"> | string
    country?: StringFilter<"GeoLocation"> | string
    countryCode?: StringFilter<"GeoLocation"> | string
    region?: StringFilter<"GeoLocation"> | string
    city?: StringFilter<"GeoLocation"> | string
    timezone?: StringFilter<"GeoLocation"> | string
    organization?: StringFilter<"GeoLocation"> | string
    organization_name?: StringFilter<"GeoLocation"> | string
    latitude?: FloatFilter<"GeoLocation"> | number
    longitude?: FloatFilter<"GeoLocation"> | number
    accuracy?: IntFilter<"GeoLocation"> | number
    createdAt?: DateTimeFilter<"GeoLocation"> | Date | string
  }

  export type CustomerChatsCreateWithoutCustomerChatDetailsInput = {
    id?: string
    botId: string
    chatId: string
    createdAt?: Date | string
    updatedAt?: Date | string
    isDeleted?: boolean
    deletedAt?: Date | string | null
    totalTokens?: number | null
    user: UserCreateNestedOneWithoutCustomerChatsInput
    GeoLocation?: GeoLocationCreateNestedManyWithoutChatInput
  }

  export type CustomerChatsUncheckedCreateWithoutCustomerChatDetailsInput = {
    id?: string
    userId: string
    botId: string
    chatId: string
    createdAt?: Date | string
    updatedAt?: Date | string
    isDeleted?: boolean
    deletedAt?: Date | string | null
    totalTokens?: number | null
    GeoLocation?: GeoLocationUncheckedCreateNestedManyWithoutChatInput
  }

  export type CustomerChatsCreateOrConnectWithoutCustomerChatDetailsInput = {
    where: CustomerChatsWhereUniqueInput
    create: XOR<CustomerChatsCreateWithoutCustomerChatDetailsInput, CustomerChatsUncheckedCreateWithoutCustomerChatDetailsInput>
  }

  export type CustomerChatsUpsertWithoutCustomerChatDetailsInput = {
    update: XOR<CustomerChatsUpdateWithoutCustomerChatDetailsInput, CustomerChatsUncheckedUpdateWithoutCustomerChatDetailsInput>
    create: XOR<CustomerChatsCreateWithoutCustomerChatDetailsInput, CustomerChatsUncheckedCreateWithoutCustomerChatDetailsInput>
    where?: CustomerChatsWhereInput
  }

  export type CustomerChatsUpdateToOneWithWhereWithoutCustomerChatDetailsInput = {
    where?: CustomerChatsWhereInput
    data: XOR<CustomerChatsUpdateWithoutCustomerChatDetailsInput, CustomerChatsUncheckedUpdateWithoutCustomerChatDetailsInput>
  }

  export type CustomerChatsUpdateWithoutCustomerChatDetailsInput = {
    id?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    chatId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalTokens?: NullableIntFieldUpdateOperationsInput | number | null
    user?: UserUpdateOneRequiredWithoutCustomerChatsNestedInput
    GeoLocation?: GeoLocationUpdateManyWithoutChatNestedInput
  }

  export type CustomerChatsUncheckedUpdateWithoutCustomerChatDetailsInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    chatId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalTokens?: NullableIntFieldUpdateOperationsInput | number | null
    GeoLocation?: GeoLocationUncheckedUpdateManyWithoutChatNestedInput
  }

  export type CustomerChatsCreateWithoutGeoLocationInput = {
    id?: string
    botId: string
    chatId: string
    createdAt?: Date | string
    updatedAt?: Date | string
    isDeleted?: boolean
    deletedAt?: Date | string | null
    totalTokens?: number | null
    user: UserCreateNestedOneWithoutCustomerChatsInput
    CustomerChatDetails?: CustomerChatDetailsCreateNestedManyWithoutChatInput
  }

  export type CustomerChatsUncheckedCreateWithoutGeoLocationInput = {
    id?: string
    userId: string
    botId: string
    chatId: string
    createdAt?: Date | string
    updatedAt?: Date | string
    isDeleted?: boolean
    deletedAt?: Date | string | null
    totalTokens?: number | null
    CustomerChatDetails?: CustomerChatDetailsUncheckedCreateNestedManyWithoutChatInput
  }

  export type CustomerChatsCreateOrConnectWithoutGeoLocationInput = {
    where: CustomerChatsWhereUniqueInput
    create: XOR<CustomerChatsCreateWithoutGeoLocationInput, CustomerChatsUncheckedCreateWithoutGeoLocationInput>
  }

  export type CustomerChatsUpsertWithoutGeoLocationInput = {
    update: XOR<CustomerChatsUpdateWithoutGeoLocationInput, CustomerChatsUncheckedUpdateWithoutGeoLocationInput>
    create: XOR<CustomerChatsCreateWithoutGeoLocationInput, CustomerChatsUncheckedCreateWithoutGeoLocationInput>
    where?: CustomerChatsWhereInput
  }

  export type CustomerChatsUpdateToOneWithWhereWithoutGeoLocationInput = {
    where?: CustomerChatsWhereInput
    data: XOR<CustomerChatsUpdateWithoutGeoLocationInput, CustomerChatsUncheckedUpdateWithoutGeoLocationInput>
  }

  export type CustomerChatsUpdateWithoutGeoLocationInput = {
    id?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    chatId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalTokens?: NullableIntFieldUpdateOperationsInput | number | null
    user?: UserUpdateOneRequiredWithoutCustomerChatsNestedInput
    CustomerChatDetails?: CustomerChatDetailsUpdateManyWithoutChatNestedInput
  }

  export type CustomerChatsUncheckedUpdateWithoutGeoLocationInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    chatId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalTokens?: NullableIntFieldUpdateOperationsInput | number | null
    CustomerChatDetails?: CustomerChatDetailsUncheckedUpdateManyWithoutChatNestedInput
  }

  export type StorageCreateManyUserInput = {
    id?: string
    botId: string
    fileName: string
    fileUrl: string
    type: string
    size: string
    status: string
    taskId: string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    isDeleted?: boolean
  }

  export type CustomerBotsCreateManyUserInput = {
    id?: string
    botName: string
    botAvatar: string
    systemPrompt?: string
    settings?: NullableJsonNullValueInput | InputJsonValue
    active?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    isDeleted?: boolean
    deletedAt?: Date | string | null
  }

  export type QuotaCreateManyUserInput = {
    id?: string
    quotaType?: $Enums.QuotaType | null
    limit?: number
    used?: number
  }

  export type CustomerChatsCreateManyUserInput = {
    id?: string
    botId: string
    chatId: string
    createdAt?: Date | string
    updatedAt?: Date | string
    isDeleted?: boolean
    deletedAt?: Date | string | null
    totalTokens?: number | null
  }

  export type ContentCreateManyUserInput = {
    id?: string
    botId: string
    content?: NullableJsonNullValueInput | InputJsonValue
    type: string
    status: string
    taskId: string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
    isDeleted?: boolean
  }

  export type StorageUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    fileName?: StringFieldUpdateOperationsInput | string
    fileUrl?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    taskId?: StringFieldUpdateOperationsInput | string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type StorageUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    fileName?: StringFieldUpdateOperationsInput | string
    fileUrl?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    taskId?: StringFieldUpdateOperationsInput | string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type StorageUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    fileName?: StringFieldUpdateOperationsInput | string
    fileUrl?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    size?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    taskId?: StringFieldUpdateOperationsInput | string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type CustomerBotsUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    botName?: StringFieldUpdateOperationsInput | string
    botAvatar?: StringFieldUpdateOperationsInput | string
    systemPrompt?: StringFieldUpdateOperationsInput | string
    settings?: NullableJsonNullValueInput | InputJsonValue
    active?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type CustomerBotsUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    botName?: StringFieldUpdateOperationsInput | string
    botAvatar?: StringFieldUpdateOperationsInput | string
    systemPrompt?: StringFieldUpdateOperationsInput | string
    settings?: NullableJsonNullValueInput | InputJsonValue
    active?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type CustomerBotsUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    botName?: StringFieldUpdateOperationsInput | string
    botAvatar?: StringFieldUpdateOperationsInput | string
    systemPrompt?: StringFieldUpdateOperationsInput | string
    settings?: NullableJsonNullValueInput | InputJsonValue
    active?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type QuotaUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    quotaType?: NullableEnumQuotaTypeFieldUpdateOperationsInput | $Enums.QuotaType | null
    limit?: IntFieldUpdateOperationsInput | number
    used?: IntFieldUpdateOperationsInput | number
  }

  export type QuotaUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    quotaType?: NullableEnumQuotaTypeFieldUpdateOperationsInput | $Enums.QuotaType | null
    limit?: IntFieldUpdateOperationsInput | number
    used?: IntFieldUpdateOperationsInput | number
  }

  export type QuotaUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    quotaType?: NullableEnumQuotaTypeFieldUpdateOperationsInput | $Enums.QuotaType | null
    limit?: IntFieldUpdateOperationsInput | number
    used?: IntFieldUpdateOperationsInput | number
  }

  export type CustomerChatsUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    chatId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalTokens?: NullableIntFieldUpdateOperationsInput | number | null
    CustomerChatDetails?: CustomerChatDetailsUpdateManyWithoutChatNestedInput
    GeoLocation?: GeoLocationUpdateManyWithoutChatNestedInput
  }

  export type CustomerChatsUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    chatId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalTokens?: NullableIntFieldUpdateOperationsInput | number | null
    CustomerChatDetails?: CustomerChatDetailsUncheckedUpdateManyWithoutChatNestedInput
    GeoLocation?: GeoLocationUncheckedUpdateManyWithoutChatNestedInput
  }

  export type CustomerChatsUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    chatId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    totalTokens?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type ContentUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    content?: NullableJsonNullValueInput | InputJsonValue
    type?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    taskId?: StringFieldUpdateOperationsInput | string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ContentUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    content?: NullableJsonNullValueInput | InputJsonValue
    type?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    taskId?: StringFieldUpdateOperationsInput | string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ContentUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    botId?: StringFieldUpdateOperationsInput | string
    content?: NullableJsonNullValueInput | InputJsonValue
    type?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    taskId?: StringFieldUpdateOperationsInput | string
    ingestionInfo?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isDeleted?: BoolFieldUpdateOperationsInput | boolean
  }

  export type CustomerChatDetailsCreateManyChatInput = {
    id?: string
    message: string
    sender: string
    tokenDetails?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type GeoLocationCreateManyChatInput = {
    id?: string
    ip: string
    country: string
    countryCode: string
    region: string
    city: string
    timezone: string
    organization: string
    organization_name: string
    latitude: number
    longitude: number
    accuracy: number
    createdAt?: Date | string
  }

  export type CustomerChatDetailsUpdateWithoutChatInput = {
    id?: StringFieldUpdateOperationsInput | string
    message?: StringFieldUpdateOperationsInput | string
    sender?: StringFieldUpdateOperationsInput | string
    tokenDetails?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CustomerChatDetailsUncheckedUpdateWithoutChatInput = {
    id?: StringFieldUpdateOperationsInput | string
    message?: StringFieldUpdateOperationsInput | string
    sender?: StringFieldUpdateOperationsInput | string
    tokenDetails?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CustomerChatDetailsUncheckedUpdateManyWithoutChatInput = {
    id?: StringFieldUpdateOperationsInput | string
    message?: StringFieldUpdateOperationsInput | string
    sender?: StringFieldUpdateOperationsInput | string
    tokenDetails?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GeoLocationUpdateWithoutChatInput = {
    id?: StringFieldUpdateOperationsInput | string
    ip?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    countryCode?: StringFieldUpdateOperationsInput | string
    region?: StringFieldUpdateOperationsInput | string
    city?: StringFieldUpdateOperationsInput | string
    timezone?: StringFieldUpdateOperationsInput | string
    organization?: StringFieldUpdateOperationsInput | string
    organization_name?: StringFieldUpdateOperationsInput | string
    latitude?: FloatFieldUpdateOperationsInput | number
    longitude?: FloatFieldUpdateOperationsInput | number
    accuracy?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GeoLocationUncheckedUpdateWithoutChatInput = {
    id?: StringFieldUpdateOperationsInput | string
    ip?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    countryCode?: StringFieldUpdateOperationsInput | string
    region?: StringFieldUpdateOperationsInput | string
    city?: StringFieldUpdateOperationsInput | string
    timezone?: StringFieldUpdateOperationsInput | string
    organization?: StringFieldUpdateOperationsInput | string
    organization_name?: StringFieldUpdateOperationsInput | string
    latitude?: FloatFieldUpdateOperationsInput | number
    longitude?: FloatFieldUpdateOperationsInput | number
    accuracy?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GeoLocationUncheckedUpdateManyWithoutChatInput = {
    id?: StringFieldUpdateOperationsInput | string
    ip?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    countryCode?: StringFieldUpdateOperationsInput | string
    region?: StringFieldUpdateOperationsInput | string
    city?: StringFieldUpdateOperationsInput | string
    timezone?: StringFieldUpdateOperationsInput | string
    organization?: StringFieldUpdateOperationsInput | string
    organization_name?: StringFieldUpdateOperationsInput | string
    latitude?: FloatFieldUpdateOperationsInput | number
    longitude?: FloatFieldUpdateOperationsInput | number
    accuracy?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}