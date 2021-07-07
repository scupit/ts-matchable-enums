import { getEnumKey, getEnumValue } from "./EnumHelper";
import { EnumKeyTypes, EnumType, EnumValueTypes } from "./EnumTyping";

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

type MatcherFunctionMap<
  E extends EnumType,
  M extends EnumKeyMap<E>,
  BodyTypeMap extends NarrowedEnumKeyMap<E, M> = NarrowedEnumKeyMap<E, M>
> = {
  [key in keyof BodyTypeMap]: BodyTypeMap[key] extends DataWrapper<infer T>
    // This is the type conversion function
    ? (body: T) => void
    : never;
}

type RealMatcherFunctionMap<
  E extends EnumType,
  M extends EnumKeyMap<E>,
  BodyTypeMap extends NarrowedEnumKeyMap<E, M> = NarrowedEnumKeyMap<E, M>
> = MatcherFunctionMap<E, M, BodyTypeMap> | ({
  [key in keyof BodyTypeMap]?: BodyTypeMap[key] extends DataWrapper<infer T>
    // This is the type conversion function
    ? (body: T) => void
    : never;
} & { ELSE(): void })

export abstract class UnknownKeyMatchable<
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
> {
  // As the name says, this is just a placeholder name so that 
  public readonly _paramMapTypePlaceholder!: ParamMap;
  public readonly abstract enumInstance: E;

  of<K extends keyof NarrowedParamMap>(
    key: K,
    data: NarrowedParamMap[K]
  ): KnownKeyMatchable<E, ParamMap, NarrowedParamMap, K> {
    return new KnownKeyMatchable(key, data);
  }
}

// Must be used as the function parameter type which is to be matched.
export type Matchable<
  U extends any extends UnknownKeyMatchable<infer E, infer ParamMap, infer NarrowedParamMap>
    ? UnknownKeyMatchable<E, ParamMap, NarrowedParamMap>
    : never
> = KnownKeyMatchable<U["enumInstance"], U["_paramMapTypePlaceholder"]>;


// Matchable item with key not known at compile time
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

export function exhaustiveMatch<
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
>(
  dataItem: KnownKeyMatchable<E, ParamMap, NarrowedParamMap>,
  matcherFuncMap: RealMatcherFunctionMap<E, ParamMap, NarrowedParamMap>
): void {
  const key = dataItem.key;

  if (key in matcherFuncMap) {
    matcherFuncMap[dataItem.key]?.(dataItem.data);
  }
  else if ("ELSE" in matcherFuncMap){
    matcherFuncMap["ELSE"]();
  }
}
