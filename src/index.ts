import { exhaustiveMatch, UnknownKeyMatchable } from "./ComplexApiResponse";

enum E_Result {
  SOME,
  NONE
}

type VoidElseValue<T> = T extends void
  ? undefined
  : T;

class KeyedResult<T> extends UnknownKeyMatchable<
  typeof E_Result,
  {
    SOME: [VoidElseValue<T>, string],
    NONE: void 
  }
> {}

const Result: KeyedResult<void> = new KeyedResult();

const value = Result.of("SOME", [, "this is a 12"]);

exhaustiveMatch(value, {
  SOME([num, description]) {
    console.log(`Num ${num} has the description: "${description}"`)
  },
  NONE() {
    console.log("Nothing")
  }
})