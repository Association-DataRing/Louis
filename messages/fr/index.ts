// Barrel des messages français — un namespace par fichier JSON.
//
// Pour ajouter un namespace : créer `messages/fr/<namespace>.json` (et son
// équivalent `messages/en/<namespace>.json`), puis l'importer ici ET dans
// `messages/en/index.ts` en gardant les deux barrels strictement alignés.
import admin from "./admin.json";
import board from "./board.json";
import chat from "./chat.json";
import commandPalette from "./commandPalette.json";
import common from "./common.json";
import components from "./components.json";
import dashboard from "./dashboard.json";
import documents from "./documents.json";
import errors from "./errors.json";
import gettingStarted from "./gettingStarted.json";
import language from "./language.json";
import login from "./login.json";
import mobileNav from "./mobileNav.json";
import nav from "./nav.json";
import print from "./print.json";
import projects from "./projects.json";
import providersCatalog from "./providersCatalog.json";
import settings from "./settings.json";
import sidebar from "./sidebar.json";
import tabularReviews from "./tabularReviews.json";
import theme from "./theme.json";
import workflows from "./workflows.json";

const fr = {
  admin,
  board,
  chat,
  commandPalette,
  common,
  components,
  dashboard,
  documents,
  errors,
  gettingStarted,
  language,
  login,
  mobileNav,
  nav,
  print,
  projects,
  providersCatalog,
  settings,
  sidebar,
  tabularReviews,
  theme,
  workflows,
};

export default fr;
