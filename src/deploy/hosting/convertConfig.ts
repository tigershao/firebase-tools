import * as _ from "lodash";

import {
  ServingConfig,
  MatcherPattern,
  Redirect,
  Rewrite,
  Header,
  TrailingSlashBehavior,
  AppAssociationBehavior,
  I18nConfig,
} from "../../hosting/api";
import { FirebaseError } from "../../error";

interface HostingSpec {
  redirects?: HostingSpecRedirect[];
  rewrites?: HostingSpecRedirect[];
  headers?: HostingSpecRedirect[];
  cleanUrls?: boolean;
  trailingSlash?: boolean;
  appAssociation?: AppAssociationBehavior;
  i18n?: I18nConfig;
}

interface HostingSpecRedirect {
  source?: string;
  glob?: string;
  regex?: string;
  destination?: string;
  dynamicLinks?: boolean;
  function?: string;
  run?: { serviceId: string; region?: string };
  type?: number;
  headers?: Array<{ key: string; value: string }>;
}

/**
 * extractPattern contains the logic for extracting exactly one glob/regexp
 * from a Hosting rewrite/redirect/header specification.
 * @param type source of the specification.
 * @param spec the specification containing a matcher.
 * @return a specific matcher.
 */
function extractPattern(
  type: "rewrite" | "redirect" | "header",
  spec: HostingSpecRedirect
): MatcherPattern {
  const glob = spec.source || spec.glob;
  const regex = spec.regex;

  if (glob && regex) {
    throw new FirebaseError(`Cannot specify a ${type} pattern with both a glob and regex.`);
  } else if (glob) {
    return { glob: glob };
  } else if (regex) {
    return { regex: regex };
  }
  throw new FirebaseError(
    `Cannot specify a ${type} with no pattern (either a glob or regex required).`
  );
}

/**
 * convertConfig takes a hosting config object from firebase.json and transforms it into
 * the valid format for sending to the Firebase Hosting REST API.
 * @param config object from firebase.json.
 * @return Hosting API object.
 */
export function convertConfig(config: HostingSpec): ServingConfig {
  const out: ServingConfig = {};

  if (!config) {
    return out;
  }

  // rewrites
  if (Array.isArray(config.rewrites)) {
    out.rewrites = config.rewrites.map(
      (rewrite): Rewrite => {
        const vRewrite = extractPattern("rewrite", rewrite);
        if (rewrite.destination) {
          return Object.assign({}, vRewrite, { path: rewrite.destination });
        } else if (rewrite.function) {
          return Object.assign({}, vRewrite, { function: rewrite.function });
        } else if (rewrite.dynamicLinks) {
          return Object.assign({}, vRewrite, { dynamicLinks: rewrite.dynamicLinks });
        } else if (rewrite.run) {
          rewrite.run = Object.assign({ region: "us-central1" }, rewrite.run);
          return Object.assign({}, vRewrite, { run: rewrite.run });
        } else {
          throw new FirebaseError(`unknown rewrite: ${JSON.stringify(rewrite)}`);
        }
      }
    );
  }

  // redirects
  if (Array.isArray(config.redirects)) {
    out.redirects = config.redirects.map((redirect) => {
      const vRedirect = extractPattern("redirect", redirect);
      const redir: Redirect = Object.assign({}, vRedirect, {
        location: redirect.destination || "",
      });
      if (redirect.type) {
        redir.statusCode = redirect.type;
      }
      return redir;
    });
  }

  // headers
  if (Array.isArray(config.headers)) {
    out.headers = config.headers.map((header) => {
      const vHeader = extractPattern("header", header);
      const headerConf: Header = Object.assign({}, vHeader, { headers: {} });
      for (const h of header.headers || []) {
        headerConf.headers[h.key] = h.value;
      }
      return headerConf;
    });
  }

  // cleanUrls
  if (_.has(config, "cleanUrls")) {
    out.cleanUrls = config.cleanUrls;
  }

  // trailingSlash
  if (config.trailingSlash === true) {
    out.trailingSlashBehavior = TrailingSlashBehavior.ADD;
  } else if (config.trailingSlash === false) {
    out.trailingSlashBehavior = TrailingSlashBehavior.REMOVE;
  }

  // App association files
  if (_.has(config, "appAssociation")) {
    out.appAssociation = config.appAssociation;
  }

  // i18n config
  if (_.has(config, "i18n")) {
    out.i18n = config.i18n;
  }

  return out;
}
