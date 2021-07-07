import { exhaustiveMatch, Matchable, UnknownKeyMatchable } from "./Matching";

enum E_Result {
  SOME,
  COMPLEX,
  NONE
}

class Result<T> extends UnknownKeyMatchable<
  typeof E_Result,
  {
    SOME: [T, string],
    COMPLEX: {data: string, other: T},
    NONE: void 
  }
> {
  public override readonly enumInstance = E_Result;
}

const value = (new Result<number>()).of("SOME", [12, "Some description is here"]);
const complexValue = (new Result<number>()).of("COMPLEX", {
  data: "Nice, this is the complex data",
  other: 400
});

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

function useComplex(n: Matchable<Result<number>>): void {
  exhaustiveMatch(n, {
    COMPLEX({data}) {
      console.log(`Matched complex data "${data}"`);
    },
    ELSE() {
      console.log("Matched very boring data")
    }
  });
}

function returnSomething<T extends number>(n: T): Matchable<Result<T>> {
  if (n > 10) {
    return (new Result<T>()).of("SOME", [n, `this is ${n}`])
  }
  else return (new Result<T>()).of("NONE", void 0);
}

const returnedVal: string = exhaustiveMatch(value, {
  SOME([_, desc]) {
    return desc;
  },
  COMPLEX({data}) {
    return data
  },
  NONE() {
    return "Nothing matched";
  }
});

// Mini tests

useComplex(complexValue);
console.log(returnedVal);
doSomething(value);
doSomething((new Result<number>()).of("NONE", void 0))

exhaustiveMatch(returnSomething(200), {
  SOME([num, desc]) {
    console.log(`returned ${num} with description ${desc}`)
  },
  NONE() {
    console.log("Got nothing, sadly");
  },
  ELSE() {
    console.log("Don't feel like dealing with complex one right now")
  }
})