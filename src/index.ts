import { DefiniteValue, exhaustiveMatch, Matchable, UnknownKeyMatchable } from "./ComplexApiResponse";

enum E_Result {
  SOME,
  NONE
}


class WideResult<T> extends UnknownKeyMatchable<
  typeof E_Result,
  {
    SOME: [DefiniteValue<T>, string],
    NONE: void 
  }
> {
  public override readonly enumInstance = E_Result;
}

type Result = WideResult<number>;
// This is the final type which represents a sum type enum
const Result: Result = new WideResult();

const value = Result.of("SOME", [12, "this is a 12"]);

function doSomething<T>(res: Matchable<Result>) {
  exhaustiveMatch(res, {
    SOME([num, description]) {
      console.log(`Num ${num} has the description: "${description}"`)
    },
    NONE() {
      console.log("Nothing")
    }
  })
}

function returnSomething(n: number): Matchable<Result> {
  if (n > 10) {
    return Result.of("SOME", [n, `this is ${n}`])
  }
  else return Result.of("NONE", void 0);
}

doSomething(value);

exhaustiveMatch(returnSomething(200), {
  SOME([num, desc]) {
    console.log(`returned ${num} with description ${desc}`)
  },
  NONE() {
    console.log("Got nothing, sadly");
  }
})