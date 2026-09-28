import { handleApi, type Env } from "../../worker/api";

// Every /api/* request goes to the shared handler; everything else is the static site
export const onRequest: PagesFunction<Env> = (context) => handleApi(context.request, context.env);
