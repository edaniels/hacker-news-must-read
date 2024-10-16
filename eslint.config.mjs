import pluginJs from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config({
  extends: [pluginJs.configs.recommended, ...tseslint.configs.recommended],
  languageOptions: { globals: globals.browser },
  files: ["**/*.ts"],
});
