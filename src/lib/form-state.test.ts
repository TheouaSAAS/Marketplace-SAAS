import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fieldErrorsFrom, formValues, invalidForm } from "./form-state";

describe("état des formulaires", () => {
  it("ne renvoie jamais un mot de passe ni un jeton dans les valeurs ressaisies", () => {
    const data = new FormData();
    data.set("email", "awa@exemple.ci");
    data.set("password", "secret123");
    data.set("passwordConfirmation", "secret123");
    data.set("token", "abc");
    data.set("$ACTION_ID_1", "interne");
    expect(formValues(data)).toEqual({ email: "awa@exemple.ci" });
  });

  it("garde la première erreur de chaque champ", () => {
    const result = z.object({ nom: z.string().min(2, "Trop court").max(3, "Trop long"), age: z.number() }).safeParse({ nom: "x", age: "a" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldErrorsFrom(result.error)).toMatchObject({ nom: "Trop court" });
    expect(invalidForm(result.error, new FormData()).status).toBe("error");
  });
});
