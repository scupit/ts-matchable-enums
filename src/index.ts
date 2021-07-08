import { exhaustive_match, else_branch, if_let, Matchable, SumTypeEnum, else_if_let, else_if, if_branch, guarded_else_if_let, guarded_if_let, guarded_branch, match_rest, partial_match } from "./Matching";

enum E_Result {
  SOME,
  COMPLEX,
  NONE
}

class Result<T> extends SumTypeEnum<
  typeof E_Result,
  {
    SOME: [T, string],
    COMPLEX: {data: string, other: T},
    NONE: void 
  }
> {
  public override readonly enumInstance = E_Result;
}

enum E_Direction {
  UP,
  DOWN
}

class Direction extends SumTypeEnum<
  typeof E_Direction,
  {
    UP: [number, number],
    DOWN: void
  }
> {
  public override readonly enumInstance = E_Direction
}


const value: Matchable<Result<number>> = (new Result<number>()).of("SOME", [0, "Some description is here"]);
const otherValue: Matchable<Direction> = (new Direction()).of("UP", [14, -55]);

const complexValue = (new Result<number>()).of("COMPLEX", {
  data: "Nice, this is the complex data",
  other: 400
});



// const tempItem: string = exhaustive_match(value, {
const tempItem = exhaustive_match(value, {
// exhaustive_match(value, {
// const tempItem: string = partial_match(value, {
// const tempItem = partial_match(value, {
// partial_match(value, {
  SOME: [
    guarded_branch(
      ([num, _]) => num > 0,
      // ([num, desc]) => `Matched guarded num > 0 (num is ${num})`
      ([num, desc]) => num
      // ([num, desc]) => { }
    ),
    guarded_branch(
      ([num, _]) => num < 0,
      // ([num, desc]) => `Matched guarded num < 0 (num is ${num})`
      ([num, desc]) => false
    ),
    match_rest(
      // ([_, __]) => "Matched the else in mini matcher"
      ([_, __]) => [12, 14] as const
    )
  ],
  COMPLEX: () => "matched complex",
  ELSE: () => "don't care"
});

// const t: string | boolean | number | readonly [number, number] = tempItem;
// const t: string | boolean | number | readonly [number, number] = tempItem;
let t: typeof tempItem;

console.warn(tempItem)

function tryThis(m: Matchable<Result<number>>) {
  return partial_match(m, {
    SOME: [
      guarded_branch(() => true,
        ([n]) => n
        // ([n]) => { }
      ),
      guarded_branch(() => true,
        ([n]) => "something" as const
      ),
      // match_rest(() => ['name'] as const)
    ],
    // ELSE: () => false
  })
}

type v = ReturnType<typeof tryThis>;

guarded_if_let(complexValue, "COMPLEX", ({other}) => other >= 400, ({other}) => {
  console.log(`other is >= 400 (is ${other})`);
},
[ ],
else_branch(() => {
  console.log("other is less than 400")
}))

// const val: string = if_let(complexValue, "NONE", () => {
const conditionalExpressionResult: string = if_let(value, "NONE", () => {
  return "NONE matched"
},
[
  guarded_else_if_let(value, "SOME", ([num, _]) => num > 12, ([num, desc]) => {
    return `Matched guarded some value where num > 12 (num === ${num})`;
  }),
  else_if_let(complexValue, "SOME", ([n, str]) => {
    return `Matched SOME with num ${n} and description ${str}`;
  }),
  else_if_let(otherValue, "UP", ([n1, n2]) => {
    console.log("WOO")
    return `${n1}${n2}`;
  }),
  else_if(true, () => {
    return "Matched normal else_if"
  }),
],
else_branch(() => {
  return "else hit";
}))

console.log(conditionalExpressionResult);

const normalIfResult: string = if_branch(10 > 12, () => {
  return "Yeah your math is bad";
}, 
// else_if_let(value, "SOME", ([_, desc]) => {
//   return "Hit normal if result with desc: " + desc;
// }),
else_if(12 < 10, () => {
  return "Noice";
}),
else_branch(() => {
  return "Normal if hit else"
}))

console.log(normalIfResult);

// const TEMP: string = if_let(value, "SOME", ([_, desc]) => {
//   console.log(`Matched description ${desc} using if_let!`);
//   return desc;
// },
// else_branch(() => "nothing matched"));

function doSomething(res: Matchable<Result<number>>): void {
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

console.log(returnedVal);
doSomething(value);
doSomething((new Result<number>()).of("NONE", void 0))

partial_match(returnSomething(202), {
  // SOME([num, desc]) {
  //   console.log(`returned ${num} with description ${desc}`)
  // },
  SOME: [
    guarded_branch(([num, _]) => num > 200,
    ([num, desc]) => {
      console.log(`Got ${num} (> 200) with description "${desc}"`)
    }),
    match_rest(([num, desc]) => {
      console.log(`Got ${num} (not > 200) with description "${desc}"`)
    })
  ],
  NONE() {
    console.log("Got nothing, sadly");
  },
  ELSE() {
    console.log("Don't feel like dealing with complex one right now")
  }
})
