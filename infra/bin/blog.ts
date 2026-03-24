#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { BlogStack } from "../lib/blog-stack";
import { WafStack } from "../lib/waf-stack";

const app = new cdk.App();
const account = process.env.CDK_DEFAULT_ACCOUNT;

// WAF must be deployed in us-east-1 for CloudFront
const wafStack = new WafStack(app, "WafStack", {
  env: { account, region: "us-east-1" },
  crossRegionReferences: true,
});

new BlogStack(app, "BlogStack", {
  env: { account, region: "us-east-1" },
  crossRegionReferences: true,
  webAclArn: wafStack.webAclArn,
});
