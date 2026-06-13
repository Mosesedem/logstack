// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "installation.mdx": () => import("../content/docs/installation.mdx?collection=docs"), "quickstart.mdx": () => import("../content/docs/quickstart.mdx?collection=docs"), "vibecoders.mdx": () => import("../content/docs/vibecoders.mdx?collection=docs"), "api/alerts.mdx": () => import("../content/docs/api/alerts.mdx?collection=docs"), "api/authentication.mdx": () => import("../content/docs/api/authentication.mdx?collection=docs"), "api/logs.mdx": () => import("../content/docs/api/logs.mdx?collection=docs"), "api/overview.mdx": () => import("../content/docs/api/overview.mdx?collection=docs"), "api/projects.mdx": () => import("../content/docs/api/projects.mdx?collection=docs"), "deployment/cloud.mdx": () => import("../content/docs/deployment/cloud.mdx?collection=docs"), "deployment/docker.mdx": () => import("../content/docs/deployment/docker.mdx?collection=docs"), "deployment/overview.mdx": () => import("../content/docs/deployment/overview.mdx?collection=docs"), "deployment/production-checklist.mdx": () => import("../content/docs/deployment/production-checklist.mdx?collection=docs"), "sdk/configuration.mdx": () => import("../content/docs/sdk/configuration.mdx?collection=docs"), "sdk/frameworks.mdx": () => import("../content/docs/sdk/frameworks.mdx?collection=docs"), "sdk/logging.mdx": () => import("../content/docs/sdk/logging.mdx?collection=docs"), "sdk/overview.mdx": () => import("../content/docs/sdk/overview.mdx?collection=docs"), }),
};
export default browserCollections;