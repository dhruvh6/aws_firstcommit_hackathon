# infra - OWNER: M3

Infrastructure as code for the whole stack. **Console-only infrastructure is not
acceptable** (docs/05-ARCHITECTURE.md § 9): if the stack is not described here,
the architecture claim in the write-up has nothing behind it, and it cannot be
redeployed from a clean checkout on Day 4.

Recommended: **AWS SAM** - one short template covers API Gateway, both Lambdas,
the five DynamoDB tables and the EventBridge schedule, and `sam local invoke`
lets M3 test the handler without deploying. Record the final choice in docs/05 § 9.

Must be described here:
- HTTP API (CORS: `content-type`, `x-business-id`), `$default` route -> `api` Lambda
- `api` Lambda - Node 22, handler `dist/index.handler`, env from docs/05 § 7
- `sweeper` Lambda + EventBridge `rate(5 minutes)`
- The five tables and their GSIs, **exactly** as docs/05 § 5 specifies, on-demand billing
- IAM per docs/05 § 8 - scoped to those tables and indexes. No `dynamodb:*`, no `Resource: "*"`
- S3 photo bucket with public ACLs blocked (P1)

```bash
npm run build:lambda
cd infra && sam deploy --guided     # first time
sam deploy                          # thereafter
npm run seed:dynamo                 # load fixtures into the tables
```

Also lives here: `docs/assets/architecture.png`, exported for the README and the
demo's 2:30 beat.
