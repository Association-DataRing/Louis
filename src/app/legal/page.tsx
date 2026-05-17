import type { Metadata } from "next";
import Link from "next/link";
import { LouisLogo } from "@/components/louis-logo";
import { IconArrowLeft } from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Mentions légales — Louis",
  description:
    "Mentions légales du site louis.data-ring.net, édité par l'Association DataRing. Identité de l'éditeur, hébergeur, propriété intellectuelle.",
  robots: { index: true, follow: true },
};

export default function LegalPage() {
  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 md:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-foreground">
            <LouisLogo className="size-5 text-primary" />
            <span className="font-heading font-medium text-xl tracking-tight">
              Louis
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
          >
            <IconArrowLeft className="size-4" />
            Retour
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 md:px-8 py-16 md:py-24 prose prose-neutral dark:prose-invert prose-headings:font-heading prose-headings:tracking-tight">
        <h1>Mentions légales</h1>

        <p className="lead text-muted-foreground">
          En application de l&apos;article 6 de la loi n° 2004-575 du 21 juin
          2004 pour la confiance dans l&apos;économie numérique (LCEN), il est
          précisé aux utilisateurs du site et du logiciel Louis l&apos;identité
          des différents intervenants dans le cadre de leur réalisation et de
          leur suivi.
        </p>

        <h2>1. Édition du logiciel et du site</h2>
        <p>
          Le logiciel Louis et le site de présentation associé sont édités par :
        </p>
        <ul>
          <li>
            <strong>Association DataRing</strong>
          </li>
          <li>Association loi 1901</li>
          <li>
            Contact :{" "}
            <a href="mailto:contact@data-ring.net">contact@data-ring.net</a>
          </li>
          <li>
            Site web :{" "}
            <a href="https://data-ring.net" rel="noreferrer">
              https://data-ring.net
            </a>
          </li>
        </ul>
        <p>
          Directeur de la publication : la présidence de l&apos;association
          DataRing.
        </p>

        <h2>2. Hébergement</h2>
        <p>
          Le site de présentation publique est susceptible d&apos;être hébergé
          chez un fournisseur européen tiers. L&apos;identité précise et les
          coordonnées de l&apos;hébergeur sont communiquées sur demande à{" "}
          <a href="mailto:contact@data-ring.net">contact@data-ring.net</a>.
        </p>
        <p>
          Le logiciel Louis lui-même est conçu pour être{" "}
          <strong>auto-hébergé par l&apos;utilisateur final</strong> sur son
          propre serveur, dans son propre datacenter ou chez un hébergeur de
          son choix. L&apos;association DataRing n&apos;héberge aucune instance
          de production de Louis pour le compte de tiers et ne reçoit aucune
          donnée d&apos;utilisateurs.
        </p>

        <h2>3. Propriété intellectuelle</h2>
        <p>
          Le code source de Louis est publié sous licence{" "}
          <strong>GNU Affero General Public License v3.0 ou ultérieure</strong>{" "}
          (AGPL-3.0-or-later). Le texte complet de la licence est disponible
          dans le dépôt du projet et à l&apos;adresse{" "}
          <a
            href="https://www.gnu.org/licenses/agpl-3.0.html"
            rel="noreferrer"
          >
            https://www.gnu.org/licenses/agpl-3.0.html
          </a>
          .
        </p>
        <p>
          Le nom « Louis », le logo associé et l&apos;identité visuelle du
          projet sont la propriété de l&apos;association DataRing. Leur usage
          en lien avec une activité commerciale doit faire l&apos;objet
          d&apos;un accord préalable écrit.
        </p>
        <p>
          Les marques et logos tiers cités sur ce site (Mistral, Scaleway,
          OVHcloud, Anthropic, OpenAI, PISTE, Pappers, etc.) restent la
          propriété exclusive de leurs détenteurs respectifs.
        </p>

        <h2>4. Données personnelles</h2>
        <p>
          Le site de présentation public ne collecte aucune donnée personnelle
          de visiteur : pas de cookie traceur, pas de mesure d&apos;audience
          tierce, pas de formulaire de contact en ligne. Le seul contact se
          fait par e-mail direct.
        </p>
        <p>
          Concernant le logiciel Louis lui-même : par construction, toute
          donnée traitée par une instance déployée chez un cabinet ou un
          juriste reste{" "}
          <strong>
            sur l&apos;infrastructure de cet utilisateur, sous sa responsabilité
            de traitement
          </strong>
          . L&apos;association DataRing n&apos;a pas accès à ces données et
          n&apos;a pas qualité de sous-traitant au sens du RGPD vis-à-vis des
          déploiements tiers de son logiciel.
        </p>
        <p>
          Pour tout exercice de droits d&apos;accès, de rectification ou
          d&apos;opposition relatifs au site public de l&apos;association :{" "}
          <a href="mailto:contact@data-ring.net">contact@data-ring.net</a>.
        </p>

        <h2>5. Signalement de vulnérabilités</h2>
        <p>
          Les vulnérabilités de sécurité doivent être signalées de manière
          responsable à{" "}
          <a href="mailto:security@data-ring.net">security@data-ring.net</a>,
          conformément à la politique de divulgation décrite dans le fichier{" "}
          <Link href="https://github.com/D4kooo/louis/blob/main/SECURITY.md">
            SECURITY.md
          </Link>{" "}
          du dépôt.
        </p>

        <h2>6. Code de conduite</h2>
        <p>
          Tout signalement relatif au code de conduite des contributeurs et
          contributrices est adressé à{" "}
          <a href="mailto:conduct@data-ring.net">conduct@data-ring.net</a>.
        </p>

        <h2>7. Loi applicable</h2>
        <p>
          Les présentes mentions légales sont régies par la loi française. Tout
          litige relatif à leur interprétation ou à leur exécution relève des
          tribunaux français compétents.
        </p>

        <p className="text-sm text-muted-foreground mt-12 not-prose">
          Dernière mise à jour : 17 mai 2026.
        </p>
      </main>
    </div>
  );
}
