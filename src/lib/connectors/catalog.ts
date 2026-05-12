import { IconBuildingCommunity, IconScale, type Icon } from "@tabler/icons-react";

export type ConnectorType = "piste" | "pappers";

export type CredentialField = {
  name: string;
  label: string;
  type: "text" | "password";
  required: boolean;
  placeholder?: string;
  help?: string;
};

export type ConnectorCategory = "official" | "commercial";

export type ConnectorMeta = {
  type: ConnectorType;
  label: string;
  description: string;
  icon: Icon;
  docsUrl: string;
  category: ConnectorCategory;
  /** APIs unlocked by configuring this connector. Surfaced in the UI. */
  unlocks: string[];
  credentialFields: CredentialField[];
};

export const CONNECTOR_CATALOG: Record<ConnectorType, ConnectorMeta> = {
  piste: {
    type: "piste",
    label: "PISTE (api.gouv.fr)",
    description:
      "Passerelle officielle vers les API juridiques publiques françaises. Une seule configuration débloque plusieurs sources.",
    icon: IconScale,
    docsUrl: "https://piste.gouv.fr/",
    category: "official",
    unlocks: ["Légifrance", "Judilibre", "JADE", "INPI", "BODACC"],
    credentialFields: [
      {
        name: "client_id",
        label: "Client ID",
        type: "text",
        required: true,
        placeholder: "Identifiant fourni par PISTE",
        help: "Créez une application sur piste.gouv.fr, puis demandez l'accès aux APIs via DataPass.",
      },
      {
        name: "client_secret",
        label: "Client secret",
        type: "password",
        required: true,
      },
    ],
  },
  pappers: {
    type: "pappers",
    label: "Pappers",
    description:
      "Données entreprises, dirigeants, bénéficiaires effectifs, comptes annuels — France entière.",
    icon: IconBuildingCommunity,
    docsUrl: "https://www.pappers.fr/api",
    category: "commercial",
    unlocks: [
      "Recherche entreprises",
      "Dirigeants",
      "Bénéficiaires",
      "Comptes annuels",
    ],
    credentialFields: [
      {
        name: "api_token",
        label: "Token API",
        type: "password",
        required: true,
        help: "Disponible dans votre espace Pappers, rubrique API.",
      },
    ],
  },
};

export const CONNECTOR_TYPES = Object.keys(CONNECTOR_CATALOG) as ConnectorType[];

export const CATEGORY_LABEL: Record<ConnectorCategory, string> = {
  official: "Officiel",
  commercial: "Commercial",
};
