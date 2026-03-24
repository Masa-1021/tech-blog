# AWS 権限一覧 (sano.masatoshi)

> 確認日: 2026-03-24
> アカウント: 338658063532
> ユーザー: `arn:aws:iam::338658063532:user/sano.masatoshi`
> IAMポリシー: `AdministratorAccess`（付与済みだがSCPで上書き）
> SCP: `arn:aws:organizations::791732163192:policy/o-1nme3smbrk/service_control_policy/p-j5ywheve`

---

## ✅ 操作可能

| サービス | 操作 | 備考 |
|---------|------|------|
| **IAM** | ユーザー・ロール・ポリシー 参照/変更 | `list-users`, `list-roles`, `list-policies` など |
| **CloudFront** | ディストリビューション 参照/変更、キャッシュ削除 | `list-distributions`, `create-invalidation` など |
| **WAFv2** | WebACL・IPセット 参照/変更 | `CLOUDFRONT` スコープ・`us-east-1` のみ |
| **Route 53** | ホストゾーン・レコード 参照/変更 | グローバルサービスのため制限なし |
| **ACM** | 証明書 参照 | `us-east-1` で確認済み |
| **SES** | アイデンティティ 参照 | `us-east-1` で確認済み（登録済みなし） |
| **STS** | `get-caller-identity` | 認証情報確認のみ |

---

## ❌ 操作不可（SCPで明示的に拒否）

| サービス | 拒否された操作 | 用途 |
|---------|---------------|------|
| **S3** | `ListBucket`, `ListAllMyBuckets`, `PutObject` など | 静的ファイルホスティング・デプロイ |
| **Lambda** | `ListFunctions` など | サーバーレス関数 |
| **DynamoDB** | `ListTables` など | NoSQLデータベース |
| **Cognito** | `ListUserPools` など | 認証・ユーザー管理 |
| **API Gateway** | `GET /restapis` など | REST/HTTP API |
| **CloudWatch Logs** | `DescribeLogGroups` など | ログ確認・デバッグ |
| **CloudWatch** | `ListMetrics` など | メトリクス・アラーム |
| **EC2** | `DescribeInstances` など | 仮想サーバー |
| **ECS** | `ListClusters` など | コンテナ管理 |
| **ECR** | `DescribeRepositories` など | コンテナイメージ管理 |
| **RDS** | `DescribeDBInstances` など | リレーショナルDB |
| **SSM** | `DescribeParameters` など | パラメータストア・接続 |
| **Secrets Manager** | `ListSecrets` など | シークレット管理 |
| **SNS** | `ListTopics` など | 通知・メッセージング |
| **SQS** | `ListQueues` など | キュー・非同期処理 |
| **CloudFormation** | `ListStacks` など | IaC・スタック管理 |
| **CodePipeline** | `ListPipelines` など | CI/CD |
| **CodeBuild** | `ListProjects` など | ビルド |
| **Amplify** | `ListApps` など | フルスタックホスティング |
| **Bedrock** | `ListFoundationModels` など | 生成AI |

---

## 影響まとめ

### tech-blog デプロイフロー

| ステップ | 操作 | 状態 |
|---------|------|------|
| 1. ローカルビルド | `npm run build` | ✅ 可能 |
| 2. S3アップロード | `aws s3 sync out/ s3://...` | ❌ SCP拒否 |
| 3. CloudFrontキャッシュ削除 | `aws cloudfront create-invalidation` | ✅ 可能（単体では意味なし） |
| 4. GitHubへpush | `git push` | ❌ 社外サービスへのアクセス不可 |
| 5. GitHub Actions自動デプロイ | mainへのpushで発火 | ❌ 上記に依存 |

### 結論

**SCPによりAWSの主要サービスがほぼすべてブロックされている。**
現状、`sano.masatoshi` ユーザーで直接操作できるのは CloudFront・WAF・Route 53・IAM のみ。
デプロイを含む実際の開発作業を行うには、Organizations管理者へのSCP緩和申請が必要。
