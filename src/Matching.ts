import { EnumKeyTypes, EnumType } from "./EnumTyping";

// Specifying all these types at once provides the ability to auto generate conversion
// functions and type-safe data handlers per response status.
type DataWrapper<T> = T;

type EnumKeyMap<E extends EnumType> = {
  // DataWrapper is used here to infer the type to contain. This essentially allows each property value
  // to be a type safe generic.
  [key in EnumKeyTypes<E>]: any extends DataWrapper<infer T>
    ? DataWrapper<T>
    : never
}

// Only take used keys from EnumKeyMap. Marks all the used keys as required while still preserving their
// types. Since these maps are defined as literals, this also ensures that extra unused items are not defined in
// types derived from the map.
type NarrowedEnumKeyMap<
  E extends EnumType,
  T extends EnumKeyMap<E>
> = Required<Omit<T, Exclude<keyof T, EnumKeyTypes<E>>>>

type MapValueTypeUnion<
  E extends EnumType,
  M extends EnumKeyMap<E>
> = {
  [key in keyof NarrowedEnumKeyMap<E, M>]: NarrowedEnumKeyMap<E, M>[key] extends DataWrapper<infer T>
    ? T
    : never
}

type AllRequiredMatcherFunctionMap<
  E extends EnumType,
  M extends EnumKeyMap<E>,
  ReturnType = void,
  BodyTypeMap extends NarrowedEnumKeyMap<E, M> = NarrowedEnumKeyMap<E, M>
> = {
  [key in keyof BodyTypeMap]: BodyTypeMap[key] extends DataWrapper<infer T>
    // This is the type conversion function
    ? (body: T) => ReturnType
    : never;
}

type RealMatcherFunctionMap<
  E extends EnumType,
  M extends EnumKeyMap<E>,
  ReturnType = void,
  BodyTypeMap extends NarrowedEnumKeyMap<E, M> = NarrowedEnumKeyMap<E, M>
> = AllRequiredMatcherFunctionMap<E, M, ReturnType, BodyTypeMap> | ({
  [key in keyof BodyTypeMap]?: BodyTypeMap[key] extends DataWrapper<infer T>
    // This is the type conversion function
    ? (body: T) => ReturnType
    : never;
} & { ELSE(): ReturnType })

export abstract class UnknownKeyMatchable<
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
> {
  // As the name says, this is just a placeholder name so that the ParamMap type can be referenced
  // per instance from outside
  public readonly _paramMapTypePlaceholder!: ParamMap;

  // Same as above, necessary for referencing the type. May also help with generating data later.
  public readonly abstract enumInstance: E;

  of<K extends keyof NarrowedParamMap>(
    key: K,
    data: NarrowedParamMap[K]
  ): KnownKeyMatchable<E, ParamMap, NarrowedParamMap, K> {
    return new KnownKeyMatchable(key, data);
  }
}

// Matchable item with key known by the compiler depending on which function branch is selected.
class KnownKeyMatchable<
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>,
  K extends keyof NarrowedParamMap = keyof NarrowedParamMap
> {
  constructor(
    // private enumInstance: E,
    public readonly key: K,
    public readonly data: NarrowedParamMap[K]
  ) { }
}

// Wrap an UnknownKeyMatchable type in function params or return type. This allows a matchable enum variant
// to be passed around and matched safely.
export type Matchable<
  U extends any extends UnknownKeyMatchable<infer E, infer ParamMap, infer NarrowedParamMap>
    ? UnknownKeyMatchable<E, ParamMap, NarrowedParamMap>
    : never
> = KnownKeyMatchable<U["enumInstance"], U["_paramMapTypePlaceholder"]>;

class ElseIfLetBranch<
  K extends keyof NarrowedParamMap,
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType = void,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>,
> {
  constructor(
    public readonly dataItemMatching: KnownKeyMatchable<E, ParamMap, NarrowedParamMap>,
    public readonly key: K,
    private readonly callback: AllRequiredMatcherFunctionMap<E, ParamMap, ReturnType, NarrowedParamMap>[K]
  ) { }

  public runCallback(): ReturnType {
    if (this.key !== this.dataItemMatching.key) {
      throw TypeError(`Tried to run a callback on a matchable item (key ${this.dataItemMatching.key}) which does not match key ${this.key}`)
    }
    return this.callback(this.dataItemMatching.data);
  }

  public shouldFire(): boolean {
    return this.dataItemMatching.key === this.key;
  }
}

class ElseIfBranch<ReturnType> {
  constructor(
    public readonly shouldFire: boolean,
    public readonly callback: () => ReturnType
  ) { }
}

class ElseBranch<ReturnType> {
  constructor(
    public readonly callback: () => ReturnType
  ) { }
}

type ElifLetInferrer<ReturnType> = any extends ElseIfLetBranch<
  infer K,
  infer E,
  infer ParamMap,
  infer R,
  infer NarrowedParamMap
>
  ? ElseIfLetBranch<K, E, ParamMap, ReturnType, NarrowedParamMap>
  : any extends ElseIfBranch<infer R>
    ? ElseIfBranch<ReturnType>
    : never;

export function if_branch<
  ReturnType = void,
  ElseFuncType extends ElseBranch<ReturnType> | undefined = ElseBranch<ReturnType> | undefined,
  TypedElifBranchList extends [ElifLetInferrer<ReturnType>, ...ElifLetInferrer<ReturnType>[]] | [ ] = [ElifLetInferrer<ReturnType>, ...ElifLetInferrer<ReturnType>[]] | [ ]
>(
  shouldRun: boolean,
  callback: () => ReturnType,
  elseIfBranches?: TypedElifBranchList,
  elseFunc?: ElseFuncType
): ElseFuncType extends undefined
    ? ReturnType | undefined
    : ReturnType
{
  if (shouldRun) {
    return callback();
  }
  if (elseIfBranches !== undefined) {
    for (const elif of elseIfBranches) {
      if (elif instanceof ElseIfLetBranch) {
        if (elif.shouldFire()) {
          return elif.runCallback();
        }
      }
      else if (elif.shouldFire) {
        return elif.callback();
      }
    }
  }
  return elseFunc?.callback()!;
}

export function if_let<
  K extends keyof NarrowedParamMap,
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType = void,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>,
  ElseFuncType extends ElseBranch<ReturnType> | undefined = ElseBranch<ReturnType> | undefined,
  TypedElifBranchList extends [ElifLetInferrer<ReturnType>, ...ElifLetInferrer<ReturnType>[]] | [ ] = [ElifLetInferrer<ReturnType>, ...ElifLetInferrer<ReturnType>[]] | [ ]
>(
  dataItem: KnownKeyMatchable<E, ParamMap, NarrowedParamMap>,
  key: K,
  callback: AllRequiredMatcherFunctionMap<E, ParamMap, ReturnType, NarrowedParamMap>[K],
  elseIfBranches?: TypedElifBranchList,
  elseFunc?: ElseFuncType
): ElseFuncType extends undefined
    ? ReturnType | undefined
    : ReturnType
{
  if (dataItem.key === key) {
    return callback(dataItem.data);
  }
  if (elseIfBranches !== undefined) {
    for (const elif of elseIfBranches) {
      if (elif instanceof ElseIfLetBranch) {
        if (elif.shouldFire()) {
          return elif.runCallback();
        }
      }
      else if (elif.shouldFire) {
        return elif.callback();
      }
    }
  }
  return elseFunc?.callback()!;
}

export function else_branch<ReturnType> (
  callback: () => ReturnType
): ElseBranch<ReturnType> {
  return new ElseBranch<ReturnType>(callback);
}

export function else_if<ReturnType> (
  shouldFire: boolean,
  callback: () => ReturnType
): ElseIfBranch<ReturnType> {
  return new ElseIfBranch(shouldFire, callback);
}

export function else_if_let<
  K extends keyof NarrowedParamMap,
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType = void,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
>(
  dataItem: KnownKeyMatchable<E, ParamMap, NarrowedParamMap>,
  key: K,
  callback: AllRequiredMatcherFunctionMap<E, ParamMap, ReturnType, NarrowedParamMap>[K]
): ElseIfLetBranch<K, E, ParamMap, ReturnType, NarrowedParamMap> {
  return new ElseIfLetBranch(dataItem, key, callback);
}

export function exhaustive_match<
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType = void,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
>(
  dataItem: KnownKeyMatchable<E, ParamMap, NarrowedParamMap>,
  matcherFuncMap: RealMatcherFunctionMap<E, ParamMap, ReturnType, NarrowedParamMap>
): ReturnType {
  const matchedKey = dataItem.key;

  if (matchedKey in matcherFuncMap) {
    const matcherFunc = matcherFuncMap[dataItem.key];

    if (typeof matcherFunc === "function") {
      return matcherFunc(dataItem.data);
    }
    else {
      // Shouldn't ever be able to happen.
      throw ReferenceError(`Tried to call function at matched key ${matchedKey}, however the function does not exist.`);
    }
  }
  else if ("ELSE" in matcherFuncMap){
    return matcherFuncMap["ELSE"]();
  }
  else {
    // Shouldn't ever be able to happen.
    throw ReferenceError(`Somehow no functions at all were matched against key ${matchedKey}. I have no idea how that is even possible.`);
  }
}