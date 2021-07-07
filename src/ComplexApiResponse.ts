import { getEnumKey, getEnumValue } from "./EnumHelper";
import { EnumKeyTypes, EnumType, EnumValueTypes } from "./EnumTyping";

// Specifying all these types at once provides the ability to auto generate conversion
// functions and type-safe data handlers per response status.
type DataWrapper<T> = T;

// This allows other keys, need 
type EnumKeyMap<E extends EnumType> = {
  // ApiDataStates is used here to infer the type This essentially allows each property value
  // to be a type safe generic.
  [key in EnumKeyTypes<E>]?: any extends DataWrapper<infer T>
    ? DataWrapper<T>
    : never
}
// & {
//   [_: number]: never;
// }

// Only take used keys from EnumKeyMap. Marks all the used keys as required while still preserving their
// types. Since these maps are defined as literals, this also ensures that extra unused items are not defined in
// types derived from the map.
type NarrowedEnumKeyMap<
  E extends EnumType,
  T extends EnumKeyMap<E>
> = Required<Omit<T, Exclude<keyof T, EnumKeyTypes<E>>>>
//  & { [_: number]: never }  

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
};

export class UnknownKeyMatchable<
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
> {
  of<K extends keyof NarrowedParamMap>(
    key: K,
    data: NarrowedParamMap[K]
  ): KnownKeyMatchable<E, ParamMap, NarrowedParamMap, K> {
    return new KnownKeyMatchable(key, data);
  }
}


// Matchable item with key not known at compile time
class KnownKeyMatchable<
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>,
  K extends keyof NarrowedParamMap = keyof NarrowedParamMap
> {
  constructor(
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
  matcherFuncMap: MatcherFunctionMap<E, ParamMap, NarrowedParamMap>
): void {
  if ((dataItem.key as string) in matcherFuncMap) {
    matcherFuncMap[dataItem.key](dataItem);
  }
}