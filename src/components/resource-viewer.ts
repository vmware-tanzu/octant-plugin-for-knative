/*
 * Copyright (c) 2020 the Octant contributors. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// components
import { Component } from "@project-octant/plugin/components/component";
import { ComponentFactory, FactoryMetadata } from "@project-octant/plugin/components/component-factory";
import { LinkFactory, LinkConfig } from "@project-octant/plugin/components/link";
import { ResourceViewerFactory, ResourceViewerConfig } from "@project-octant/plugin/components/resource-viewer";
import { TextFactory } from "@project-octant/plugin/components/text";

import { ConditionSummaryFactory } from "./conditions";
import { RuntimeObject } from "./metadata";

export { ResourceViewerConfig };

import ctx from "../context";

export interface Node {
  name?: string;
  apiVersion?: string;
  kind?: string;
  status?: string;
  details?: Component<any>[];
  path?: Component<LinkConfig>;
};

export interface Edge {
  node: string;
  edge: string;
};

interface KnativeResourceViewerParameters {
  self: RuntimeObject;
  factoryMetadata?: FactoryMetadata;
}

export class KnativeResourceViewerFactory implements ComponentFactory<ResourceViewerConfig> {
  private readonly self: RuntimeObject;
  private readonly factoryMetadata?: FactoryMetadata;

  private readonly nodes: {[key: string]: Node};
  private readonly edges: {[key: string]: Edge[]};

  constructor({ self, factoryMetadata }: KnativeResourceViewerParameters) {
    this.self = self;
    this.factoryMetadata = factoryMetadata;

    this.nodes = {};
    this.edges = {};
  }

  addNode(obj: RuntimeObject, { status, details }: { status?: string, details?: Component<any>[] } = {}): string{
    const key = this.nodeKey(obj);
    if (this.nodes[key]) {
      return key;
    }

    const ready = new ConditionSummaryFactory({ conditions: (<any>obj).status.conditions, type: "Ready" });
    status = status || ready.statusRV();
    details = details || [
      new TextFactory({ value: `${obj.apiVersion} ${obj.kind} is ${ready.statusText()}` }).toComponent(),
    ];
    const link = new LinkFactory({
      value: obj.metadata.name || "",
      ref: ctx.linker({
        apiVersion: obj.apiVersion,
        kind: obj.kind,
        name: obj.metadata.name,
      }, obj.kind == "Revision" ? {
        apiVersion: obj.apiVersion,
        kind: "Configuration",
        name: (obj.metadata.labels || {})["serving.knative.dev/configuration"] || "_"
      } : void 0),
    });

    this.nodes[key] = {
      apiVersion: obj.apiVersion,
      kind: obj.kind,
      name: obj.metadata.name,
      path: link.toComponent(),
      ...( status && { status } ),
      ...( details && { details } ),
    };
    return key;
  }

  addEdge(from: RuntimeObject, to: RuntimeObject, type: string) {
    const fromKey = this.addNode(from);
    const toKey = this.addNode(to);
    if (!this.edges[fromKey]) {
      this.edges[fromKey] = [];
    }
    this.edges[fromKey].push({
      edge: type,
      node: toKey,
    });
  }

  private nodeKey(obj: RuntimeObject): string {
    return obj.metadata.uid || "";
  }

  toComponent(): Component<ResourceViewerConfig> {
    return new ResourceViewerFactory({
      options: {
        nodes: this.nodes,
        edges: this.edges,
        selected: this.nodeKey(this.self),
      },
      factoryMetadata: this.factoryMetadata,
    }).toComponent();
  }
}
