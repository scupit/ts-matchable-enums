import { RuleTester } from "eslint";
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
> = AllRequiredMatcherFunctionMap<E, M, ReturnType, BodyTypeMap> | (
  Partial<AllRequiredMatcherFunctionMap<E, M, ReturnType, BodyTypeMap>>
  & { ELSE(): ReturnType }
)

export abstract class SumTypeEnum<
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
> {
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
// This is essentially the "variant instance" of a SumTypeEnum.
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

type SumTypeEnumInferrer = any extends SumTypeEnum<infer E, infer ParamMap, infer NarrowedParamMap>
  ? SumTypeEnum<E, ParamMap, NarrowedParamMap>
  : never

type EnumTypeInferrer<T> = T extends SumTypeEnum<infer E, infer _, infer _>
  ? E
  : never;

// Wrap an SumTypeEnum type in function params or return type. This allows a matchable enum variant
// to be passed around and matched safely.
export type Matchable<
  U extends SumTypeEnumInferrer = SumTypeEnumInferrer
> = KnownKeyMatchable<
  EnumTypeInferrer<U>,
  U extends SumTypeEnum<infer E, infer ParamMap, infer NarrowedParamMap>
    ? ParamMap
    : never
>;

class ElseIfLetBranch<
  K extends keyof NarrowedParamMap,
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType = void,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
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

class GuardedElseIfLetBranch<
  K extends keyof NarrowedParamMap,
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType = void,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
> extends ElseIfLetBranch<K, E, ParamMap, ReturnType, NarrowedParamMap> {
  constructor(
    private readonly guardFunc: AllRequiredMatcherFunctionMap<E, ParamMap, boolean, NarrowedParamMap>[K],
    dataItemMatching: KnownKeyMatchable<E, ParamMap, NarrowedParamMap>,
    key: K,
    callback: AllRequiredMatcherFunctionMap<E, ParamMap, ReturnType, NarrowedParamMap>[K]
  ) {
    super(dataItemMatching, key, callback);
  }

  public override shouldFire(): boolean {
    return super.shouldFire() && this.guardFunc(this.dataItemMatching.data)
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

// Used for inferring the internal generic types for else_if_let branches.
// When combined with variadic tuples, this allows an "infinite" number of else-if
// branch expressions to be typed individually.
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

// The list of ways the else-if branches can be represented. ElifLetInferrer
// deduces whether the branch is an else_if_let or a normal else_if_branch.
type ElifBranchParamTypes<ReturnType> =
  [ElifLetInferrer<ReturnType>, ...ElifLetInferrer<ReturnType>[]]
  | ElifLetInferrer<ReturnType>
  | [ ];

// Normal 'if' control flow which can also be used as an expression. The return type is type safe,
// meaning that it is ReturnType | undefined when an else branch is not given. This is because
// the else branch is the only one guaranteed to run, and therefore is the only one that can
// guarantee a return.
export function if_branch<
  ReturnType = void,
  ElseFuncType extends ElseBranch<ReturnType> | undefined = ElseBranch<ReturnType> | undefined,
  TypedElifBranchList extends ElifBranchParamTypes<ReturnType> = ElifBranchParamTypes<ReturnType>,
>(
  shouldRun: boolean,
  callback: () => ReturnType,
  elseIfBranches?: TypedElifBranchList,
  elseFunc?: ElseFuncType
): ElseFuncType extends void
    ? ReturnType | void
    : ReturnType
{
  if (shouldRun) {
    return callback();
  }
  return runOtherBranches(elseIfBranches, elseFunc);
}

// Same as if let, but guarded. Guarded if-let only runs when the guard predicate returns true.
export function guarded_if_let<
  K extends keyof NarrowedParamMap,
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType = void,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>,
  ElseFuncType extends ElseBranch<ReturnType> | undefined = ElseBranch<ReturnType> | undefined,
  TypedElifBranchList extends ElifBranchParamTypes<ReturnType> = ElifBranchParamTypes<ReturnType>
>(
  dataItem: KnownKeyMatchable<E, ParamMap, NarrowedParamMap>,
  key: K,
  guardFunc: AllRequiredMatcherFunctionMap<E, ParamMap, boolean, NarrowedParamMap>[K],
  callback: AllRequiredMatcherFunctionMap<E, ParamMap, ReturnType, NarrowedParamMap>[K],
  elseIfBranches?: TypedElifBranchList,
  elseFunc?: ElseFuncType
): ElseFuncType extends void
    ? ReturnType | void
    : ReturnType
{
  if (dataItem.key === key && guardFunc(dataItem.data)) {
    return callback(dataItem.data);
  }
  return runOtherBranches(elseIfBranches, elseFunc);
}

// "if let control flow". Only runs when the Key matches the variant type. Same expression rules
// as the normal if_branch above.
export function if_let<
  K extends keyof NarrowedParamMap,
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType = void,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>,
  ElseFuncType extends ElseBranch<ReturnType> | undefined = ElseBranch<ReturnType> | undefined,
  TypedElifBranchList extends ElifBranchParamTypes<ReturnType> = ElifBranchParamTypes<ReturnType>
>(
  dataItem: KnownKeyMatchable<E, ParamMap, NarrowedParamMap>,
  key: K,
  callback: AllRequiredMatcherFunctionMap<E, ParamMap, ReturnType, NarrowedParamMap>[K],
  elseIfBranches?: TypedElifBranchList,
  elseFunc?: ElseFuncType
): ElseFuncType extends void
    ? ReturnType | void
    : ReturnType
{
  if (dataItem.key === key) {
    return callback(dataItem.data);
  }
  return runOtherBranches(elseIfBranches, elseFunc);
}

// Runs the branches following if_branch and if_let.
function runOtherBranches<
  ReturnType,
  ElseFuncType extends ElseBranch<ReturnType> | undefined = ElseBranch<ReturnType> | undefined,
  TypedElifBranchList extends ElifBranchParamTypes<ReturnType> = ElifBranchParamTypes<ReturnType>
>(
  elseIfBranches?: TypedElifBranchList,
  elseFunc?: ElseFuncType
): ReturnType {
  if (Array.isArray(elseIfBranches)) {
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

// Normal else-if control flow. Generates the else-if branches for if_let and else_if.
export function else_if<ReturnType> (
  shouldFire: boolean,
  callback: () => ReturnType
): ElseIfBranch<ReturnType> {
  return new ElseIfBranch(shouldFire, callback);
}

// Same matching rules as if_let. Generated else-if-let branches just like else-if above.
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

export function guarded_else_if_let<
  K extends keyof NarrowedParamMap,
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType = void,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
>(
  dataItem: KnownKeyMatchable<E, ParamMap, NarrowedParamMap>,
  key: K,
  guardFunc: AllRequiredMatcherFunctionMap<E, ParamMap, boolean, NarrowedParamMap>[K],
  callback: AllRequiredMatcherFunctionMap<E, ParamMap, ReturnType, NarrowedParamMap>[K]
): GuardedElseIfLetBranch<K, E, ParamMap, ReturnType, NarrowedParamMap> {
  return new GuardedElseIfLetBranch(guardFunc, dataItem, key, callback);
}

class PartialGuardedElseIfLetBranch<
  K extends keyof NarrowedParamMap,
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
> {
  constructor(
    private readonly guardFunc: AllRequiredMatcherFunctionMap<E, ParamMap, boolean, NarrowedParamMap>[K],
    private readonly callback: AllRequiredMatcherFunctionMap<E, ParamMap, ReturnType, NarrowedParamMap>[K]
  ) { }

  toFullGuardedElseIfLetBranch(
    key: K,
    dataItemMatching: KnownKeyMatchable<E, ParamMap, NarrowedParamMap, K>
  ): GuardedElseIfLetBranch<K, E, ParamMap, ReturnType, NarrowedParamMap> {
    return new GuardedElseIfLetBranch(
      this.guardFunc,
      dataItemMatching,
      key,
      this.callback 
    );
  }
}

export function guarded_branch<
  K extends keyof NarrowedParamMap,
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap>,
>(
  guardFunc: AllRequiredMatcherFunctionMap<E, ParamMap, boolean, NarrowedParamMap>[K],
  callback: AllRequiredMatcherFunctionMap<E, ParamMap, ReturnType, NarrowedParamMap>[K]
): PartialGuardedElseIfLetBranch<K, E, ParamMap, ReturnType, NarrowedParamMap> {
  return new PartialGuardedElseIfLetBranch(guardFunc, callback);
}

class ReceivingElseBranch<
  K extends keyof NarrowedParamMap,
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType = void,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
> {
  constructor(
    private readonly key: K,
    private readonly dataItemMatching: KnownKeyMatchable<E, ParamMap, NarrowedParamMap, K>,
    private readonly callback: AllRequiredMatcherFunctionMap<E, ParamMap, ReturnType, NarrowedParamMap>[K]
  ) { }

  runCallback(): ReturnType {
    if (this.key !== this.dataItemMatching.key) {
      throw TypeError(`Tried to run a callback on a matchable item (key ${this.dataItemMatching.key}) which does not match key ${this.key}`)
    }
    return this.callback(this.dataItemMatching.data);
  }
}

class PartialReceivingElseBranch<
  K extends keyof NarrowedParamMap,
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
> {
  constructor(
    private readonly callback: AllRequiredMatcherFunctionMap<E, ParamMap, ReturnType, NarrowedParamMap>[K]
  ) { }

  toFullReceivingElseBranch(
    key: K,
    dataItemMatching: KnownKeyMatchable<E, ParamMap, NarrowedParamMap, K>
  ): ReceivingElseBranch<K, E, ParamMap, ReturnType, NarrowedParamMap> {
    return new ReceivingElseBranch(key, dataItemMatching, this.callback);
  }
}

export function match_rest<
  K extends keyof NarrowedParamMap,
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
>(
  callback: AllRequiredMatcherFunctionMap<E, ParamMap, ReturnType, NarrowedParamMap>[K]
): PartialReceivingElseBranch<K, E, ParamMap, ReturnType, NarrowedParamMap> {
  return new PartialReceivingElseBranch(callback);
}

type ExhaustiveMultiMatchBranchParam<
  K extends keyof NarrowedParamMap,
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
> = [
  ...PartialGuardedElseIfLetBranch<K, E, ParamMap, ReturnType, NarrowedParamMap>[],
  PartialReceivingElseBranch<K, E, ParamMap, ReturnType, NarrowedParamMap>
]

type PartialMultiMatchBranchParam<
  K extends keyof NarrowedParamMap,
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
> = ExhaustiveMultiMatchBranchParam<K, E, ParamMap, ReturnType, NarrowedParamMap>
  | [
      PartialGuardedElseIfLetBranch<K, E, ParamMap, ReturnType, NarrowedParamMap>,
      ...PartialGuardedElseIfLetBranch<K, E, ParamMap, ReturnType, NarrowedParamMap>[]
    ]

type AllRequiredMultiMatchableBranchEvaluationMap<
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType,
  BodyTypeMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
> = {
  [key in keyof BodyTypeMap]: BodyTypeMap[key] extends DataWrapper<infer T>
    ? ((body: T) => ReturnType) | ExhaustiveMultiMatchBranchParam<key, E, ParamMap, ReturnType, BodyTypeMap>
    : never
}

type AllOptionalMultiMatchableBranchEvaluationMap<
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType,
  BodyTypeMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
> = MultiMatchableBranchEvaluationMap<E, ParamMap, ReturnType, BodyTypeMap>
  | (
    {
      [key in keyof BodyTypeMap]?: BodyTypeMap[key] extends DataWrapper<infer T>
        // ? ((body: T) => ReturnType) | PartialMultiMatchBranchParam<key, E, ParamMap, ReturnType, BodyTypeMap>
        ? ((body: T) => ReturnType) | PartialMultiMatchBranchParam<key, E, ParamMap, ReturnType, BodyTypeMap>
        : never
    } & { ELSE?(): ReturnType }
  )
// }

type MultiMatchableBranchEvaluationMap<
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType = void,
  BodyTypeMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
> = AllRequiredMultiMatchableBranchEvaluationMap<E, ParamMap, ReturnType, BodyTypeMap>
  | (
    Partial<AllRequiredMultiMatchableBranchEvaluationMap<E, ParamMap, ReturnType, BodyTypeMap>> 
    & { ELSE(): ReturnType }
  )

type PartialGuardedElseIfLetBranchReturnTypeInferrer<
  K extends keyof NarrowedParamMap,
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap>
> = any extends PartialGuardedElseIfLetBranch<K, E, ParamMap, infer ReturnType, NarrowedParamMap>
      ? ReturnType
      : never;

type VariadicInferrer<
  K extends keyof NarrowedParamMap,
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap>,
  T extends [...PartialGuardedElseIfLetBranch<K, E, ParamMap, unknown, NarrowedParamMap>[]]
> = [...PartialGuardedElseIfLetBranchReturnTypeInferrer<K, E, ParamMap, NarrowedParamMap>[]] & {length: T["length"]}
// [
//   ...PartialGuardedElseIfLetBranch<K, E, ParamMap, ReturnType, NarrowedParamMap>[],
//   PartialReceivingElseBranch<K, E, ParamMap, ReturnType, NarrowedParamMap>
// ]

type ExtractBeginning<
  T extends any[],
  V extends any,
  A extends [...T, V]
> = [...T];

type ExhaustiveMatcherReturnTypeMap<
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap>,
  // MatcherType extends AllOptionalMultiMatchableBranchEvaluationMap<E, ParamMap, unknown, NarrowedParamMap>
  MatcherType extends MultiMatchableBranchEvaluationMap<E, ParamMap, unknown, NarrowedParamMap>
> = MatcherType extends MultiMatchableBranchEvaluationMap<E, ParamMap, unknown, NarrowedParamMap>
      ? {
        [key in keyof MatcherType]: MatcherType[key] extends ((body: infer T) => infer R)
          ? R
          : key extends keyof NarrowedParamMap
            ?  MatcherType[key] extends [
              // Don't think this is going to work. RT is probably just one type
              ...PartialGuardedElseIfLetBranch<key, E, ParamMap, infer RT, NarrowedParamMap>[],
              PartialReceivingElseBranch<key, E, ParamMap, infer R, NarrowedParamMap>
            ]
              ? RT | R
              : never
            : never
      }
      : never

type ExhaustiveMatcherReturnTypeUnion<
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap>,
  // MatcherType extends AllOptionalMultiMatchableBranchEvaluationMap<E, ParamMap, unknown, NarrowedParamMap>
  MatcherType extends MultiMatchableBranchEvaluationMap<E, ParamMap, unknown, NarrowedParamMap>
> = ExhaustiveMatcherReturnTypeMap<E, ParamMap, NarrowedParamMap, MatcherType>[keyof ExhaustiveMatcherReturnTypeMap<E, ParamMap, NarrowedParamMap, MatcherType>];

// Essentially a switch case where each case is an if_let. This is type safe and exhaustive. The compiler
// will issue an error if not all variants of a SumTypeEnum are matched. Therefore when an ELSE branch is
// not present, all variants of a SumTypeEnum must be matched explicitly.
export function exhaustive_match<
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>,
  MatcherType extends MultiMatchableBranchEvaluationMap<E, ParamMap, unknown extends ReturnType ? unknown : ReturnType, NarrowedParamMap>
    = MultiMatchableBranchEvaluationMap<E, ParamMap, unknown extends ReturnType ? unknown : ReturnType, NarrowedParamMap>
>(
  dataItem: KnownKeyMatchable<E, ParamMap, NarrowedParamMap>,
  matcherFuncMap: MatcherType
): ExhaustiveMatcherReturnTypeUnion<E, ParamMap, NarrowedParamMap, MatcherType> {
  const matchedKey = dataItem.key;

  if (matchedKey in matcherFuncMap) {
    const matcher = matcherFuncMap[dataItem.key];

    if (typeof matcher === "function") {
      return matcher(dataItem.data) as ExhaustiveMatcherReturnTypeUnion<E, ParamMap, NarrowedParamMap, MatcherType>;
    }
    else if (Array.isArray(matcher)) {
      return evaluateMultimatchBranch(
        dataItem.key,
        dataItem,
        matcher as ExhaustiveMultiMatchBranchParam<typeof matchedKey, E, ParamMap, ExhaustiveMatcherReturnTypeUnion<E, ParamMap, NarrowedParamMap, MatcherType>, NarrowedParamMap>
      );
    }
    else {
      // Shouldn't ever be able to happen.
      throw ReferenceError(`Tried to call function at matched key ${matchedKey}, however the function does not exist.`);
    }
  }
  else if ("ELSE" in matcherFuncMap){
    return matcherFuncMap["ELSE"]() as ExhaustiveMatcherReturnTypeUnion<E, ParamMap, NarrowedParamMap, MatcherType>;
  }
  else {
    // Shouldn't ever be able to happen.
    throw ReferenceError(`Somehow no functions at all were matched against key ${matchedKey}. I have no idea how that is even possible.`);
  }
}

/*
  partial_match works the same as exhaustive_match. However, it is not required to be exhaustive in contexts where
  its return value is either unused or is allowed to be undefined. This means that partial_match is required to
  be exhaustive when its return value is explicitly not allowed to be undefined.
  
  There are two situations where partial_match is required to be exhaustive:
    - The match result is assigned to a variable whose type has been explicity defined and does not include undefined.
    - The match result is returned from a function whose return type is explicitly defined and does not include undefined.
  
  Essentially partial_match must be exhaustive when its return type is used and explicitly required
*/
export function partial_match<
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>,
  MatcherType extends AllOptionalMultiMatchableBranchEvaluationMap<E, ParamMap, ReturnType, NarrowedParamMap>
    = AllOptionalMultiMatchableBranchEvaluationMap<E, ParamMap, ReturnType, NarrowedParamMap>
>(
  dataItem: KnownKeyMatchable<E, ParamMap, NarrowedParamMap>,
  matcherFuncMap: MatcherType
): MatcherType extends MultiMatchableBranchEvaluationMap<E, ParamMap, ReturnType, NarrowedParamMap>
  ? ReturnType
  : ReturnType | void
{
  const matchedKey = dataItem.key;

  if (matchedKey in matcherFuncMap) {
    const matcher = matcherFuncMap[matchedKey];

    if (typeof matcher === "function") {
      return matcher(dataItem.data);
    }
    else if (Array.isArray(matcher)) {
      return evaluatePartialMultimatchBranch(
        matchedKey,
        dataItem,
        matcher as PartialMultiMatchBranchParam<typeof matchedKey, E, ParamMap, ReturnType, NarrowedParamMap> 
      );
    }
    else {
      // Shouldn't ever be able to happen
      throw ReferenceError(`Tried to call function at matched key ${matchedKey}, however the function does not exist.`);
    }
  }
  else if ("ELSE" in matcherFuncMap){
    return matcherFuncMap["ELSE"]!();
  }
  else {
    // Shouldn't ever be able to happen.
    throw ReferenceError(`Somehow no functions at all were matched against key ${matchedKey}. I have no idea how that is even possible.`);
  }
}

function separate<T extends any[], V>(items: [...T, V]): {middle: T, last: V} {
  // items = 
  return {
    middle: items.slice(0, items.length - 1) as T,
    last: items[items.length - 1]
  }
}

function evaluatePartialMultimatchBranch<
  K extends keyof NarrowedParamMap,
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
>(
  key: K,
  dataItemMatching: KnownKeyMatchable<E, ParamMap, NarrowedParamMap, K>,
  branchEvaluators: PartialMultiMatchBranchParam<K, E, ParamMap, ReturnType, NarrowedParamMap>
): ReturnType {
  const [partialInitialBranch, ...rest] = branchEvaluators;

  if (partialInitialBranch instanceof PartialReceivingElseBranch) {
    return partialInitialBranch
      .toFullReceivingElseBranch(key, dataItemMatching)
      .runCallback();
  }

  const initialBranch = partialInitialBranch.toFullGuardedElseIfLetBranch(key, dataItemMatching);

  if (initialBranch.shouldFire()) {
    return initialBranch.runCallback();
  }

  // Rest is 1 or more PartialGuardedElseIfLetBranches,
  // 1 PartialReceivingElseBranch,
  // or 1 or more PartialGuardedElseIfLetBranches with 1 PartialReveicingElseBranch at the end

  for (const partialBranch of rest) {
    if (partialBranch instanceof PartialGuardedElseIfLetBranch) {
      const fullBranch = partialBranch.toFullGuardedElseIfLetBranch(key, dataItemMatching);
      if (fullBranch.shouldFire()) {
        return fullBranch.runCallback();
      }
    }
    else {
      const fullBranch = partialBranch.toFullReceivingElseBranch(key, dataItemMatching);
      return fullBranch.runCallback();
    }
  }

  return (void 0)!;
}

function evaluateMultimatchBranch<
  K extends keyof NarrowedParamMap,
  E extends EnumType,
  ParamMap extends EnumKeyMap<E>,
  ReturnType,
  NarrowedParamMap extends NarrowedEnumKeyMap<E, ParamMap> = NarrowedEnumKeyMap<E, ParamMap>
>(
  key: K,
  dataItemMatching: KnownKeyMatchable<E, ParamMap, NarrowedParamMap, K>,
  branchEvaluators: ExhaustiveMultiMatchBranchParam<K, E, ParamMap, ReturnType, NarrowedParamMap>
): ReturnType {
  const {
    middle: partialMiddleBranches,
    last: partialEndBranch
  } = separate(branchEvaluators);

  for (const partialMiddleBranch of partialMiddleBranches) {
    const middleBranch = partialMiddleBranch.toFullGuardedElseIfLetBranch(key, dataItemMatching);
    if (middleBranch.shouldFire()) {
      return middleBranch.runCallback();
    }
  }

  return partialEndBranch.toFullReceivingElseBranch(key, dataItemMatching).runCallback();
}
