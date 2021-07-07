import { exhaustiveMatch, Matchable, UnknownKeyMatchable } from "./ComplexApiResponse";

enum E_Result {
  SOME,
  NONE
}

class Result<T> extends UnknownKeyMatchable<
  typeof E_Result,
  {
    SOME: [T, string],
    NONE: void 
  }
> {
  public override readonly enumInstance = E_Result;
}

const value = (new Result<number>()).of("SOME", [12, "this is a 12"]);

function doSomething(res: Matchable<Result<number>>) {
  exhaustiveMatch(res, {
    SOME([num, description]) {
      console.log(`Num ${num} has the description: "${description}"`)
    },
    // Else branch exhausts all other options
    ELSE() {
      console.log("Else branch hit, nothing was matched");
    },
    // NONE() {
    //   console.log("Nothing")
    // }
  })
}

function returnSomething<T extends number>(n: T): Matchable<Result<T>> {
  if (n > 10) {
    return (new Result<T>()).of("SOME", [n, `this is ${n}`])
  }
  else return (new Result<T>()).of("NONE", void 0);
}

doSomething(value);
doSomething((new Result<number>()).of("NONE", void 0))

exhaustiveMatch(returnSomething(200), {
  SOME([num, desc]) {
    console.log(`returned ${num} with description ${desc}`)
  },
  NONE() {
    console.log("Got nothing, sadly");
  }
})