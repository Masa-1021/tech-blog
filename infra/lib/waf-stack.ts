import * as cdk from "aws-cdk-lib";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import type { Construct } from "constructs";

export class WafStack extends cdk.Stack {
  public readonly webAclArn: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const allowedIps = [
      "192.218.140.236/32",
      "192.218.140.237/32",
      "192.218.140.238/32",
      "192.218.140.239/32",
      "192.218.140.240/32",
      "192.218.140.241/32",
    ];

    const ipSet = new wafv2.CfnIPSet(this, "AllowedIpSet", {
      addresses: allowedIps,
      ipAddressVersion: "IPV4",
      scope: "CLOUDFRONT",
      description: "Allowed IP addresses for blog access",
    });

    const webAcl = new wafv2.CfnWebACL(this, "WebAcl", {
      defaultAction: { block: {} },
      scope: "CLOUDFRONT",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "BlogWebAcl",
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: "AllowSpecificIPs",
          priority: 1,
          action: { allow: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "AllowSpecificIPs",
            sampledRequestsEnabled: true,
          },
          statement: {
            ipSetReferenceStatement: {
              arn: ipSet.attrArn,
            },
          },
        },
      ],
    });

    this.webAclArn = webAcl.attrArn;

    new cdk.CfnOutput(this, "WebAclArn", {
      value: webAcl.attrArn,
      description: "WAF WebACL ARN for CloudFront",
    });
  }
}
