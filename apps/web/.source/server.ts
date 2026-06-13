// @ts-nocheck
import { default as __fd_glob_17 } from "../content/docs/meta.json?collection=meta"
import * as __fd_glob_16 from "../content/docs/sdk/overview.mdx?collection=docs"
import * as __fd_glob_15 from "../content/docs/sdk/logging.mdx?collection=docs"
import * as __fd_glob_14 from "../content/docs/sdk/frameworks.mdx?collection=docs"
import * as __fd_glob_13 from "../content/docs/sdk/configuration.mdx?collection=docs"
import * as __fd_glob_12 from "../content/docs/deployment/production-checklist.mdx?collection=docs"
import * as __fd_glob_11 from "../content/docs/deployment/overview.mdx?collection=docs"
import * as __fd_glob_10 from "../content/docs/deployment/docker.mdx?collection=docs"
import * as __fd_glob_9 from "../content/docs/deployment/cloud.mdx?collection=docs"
import * as __fd_glob_8 from "../content/docs/api/projects.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/api/overview.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/api/logs.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/api/authentication.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/api/alerts.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/vibecoders.mdx?collection=docs"
import * as __fd_glob_2 from "../content/docs/quickstart.mdx?collection=docs"
import * as __fd_glob_1 from "../content/docs/installation.mdx?collection=docs"
import * as __fd_glob_0 from "../content/docs/index.mdx?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.doc("docs", "content/docs", {"index.mdx": __fd_glob_0, "installation.mdx": __fd_glob_1, "quickstart.mdx": __fd_glob_2, "vibecoders.mdx": __fd_glob_3, "api/alerts.mdx": __fd_glob_4, "api/authentication.mdx": __fd_glob_5, "api/logs.mdx": __fd_glob_6, "api/overview.mdx": __fd_glob_7, "api/projects.mdx": __fd_glob_8, "deployment/cloud.mdx": __fd_glob_9, "deployment/docker.mdx": __fd_glob_10, "deployment/overview.mdx": __fd_glob_11, "deployment/production-checklist.mdx": __fd_glob_12, "sdk/configuration.mdx": __fd_glob_13, "sdk/frameworks.mdx": __fd_glob_14, "sdk/logging.mdx": __fd_glob_15, "sdk/overview.mdx": __fd_glob_16, });

export const meta = await create.meta("meta", "content/docs", {"meta.json": __fd_glob_17, });