import { BasicResponse } from "./ComplexApiResponse.ts";
import { ComplexApiResponse } from "./ComplexApiResponse.ts";
import { HttpStatus } from "./HttpStatus.ts";

interface Thing {
  theData: string;
}

const res = new BasicResponse(
  HttpStatus.OK,
  {
    theData: "Wow, very nice"
  }
); 

const notFoundRes = new BasicResponse(
  HttpStatus.NO_CONTENT,
  null
)

const noContentRes = new BasicResponse(
  HttpStatus.NO_CONTENT,
  undefined
)

const temp = new ComplexApiResponse<{
  // Honestly this looks like something I could use to simulate enum pattern matching.
  OK: [Thing, string];
  NOT_FOUND: [null, Thing];
}>(
  // res,
  notFoundRes,
  {
    OK(body) {
      return body.theData;
    },
    NOT_FOUND() {
      return {
        theData: "So sad, nothing was found"
      };
    }
  }
)

temp.matchStatus({
  OK(stringFromThing) {
    console.log(`This is the fancy string: ${stringFromThing}`)
  },
  NOT_FOUND(body) {
    console.log(body);
  }
})