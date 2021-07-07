import { exhaustive_match, else_branch, if_let, Matchable, UnknownKeyMatchable, else_if_let } from "./Matching";

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

const val: string = if_let(value, "NONE", () => {
  console.log("NONE matched");
  return "n";
},
[
  else_if_let("SOME", ([n, str]) => {
    console.log(`Matched SOME with num ${n} and description ${str}`)
    return str;
  })
],
else_branch(() => {
  console.log("Else matched")
  return "el";
}))

// const TEMP: string = if_let(value, "SOME", ([_, desc]) => {
//   console.log(`Matched description ${desc} using if_let!`);
//   return desc;
// },
// else_branch(() => "nothing matched"));

function doSomething(res: Matchable<Result<number>>) {
  exhaustive_match(res, {
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
  exhaustive_match(n, {
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

const returnedVal: string = exhaustive_match(value, {
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

exhaustive_match(returnSomething(200), {
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