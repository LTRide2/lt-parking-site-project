# Lesson D1 — Write the CloudFormation templates

> **Track:** Deploy · **Lesson 2 of 6**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** moderate (lots of new AWS vocabulary — VPC, security group, IAM role — but the templates are already written for you; you're reading, validating, and making one edit)
> **🧩 Prerequisites:** you've finished [Lesson D0 — One-time AWS account setup](D0-aws-account-setup.md) (AWS CLI configured, SSH key downloaded, `deploy/params/prod.json` filled in).
> **🌿 CR branch:** `cr/d1-cfn-templates` (off `main`) · **📄 Source CR:** [CR D1](../deployment-guide.md#cr-d1--write-the-cloudformation-templates-the-infrastructure-code) · **🗺 Big picture:** [plan.md §10](../../plan.md#10-aws-deployment--ec2--rds-via-cloudformation).

---

## 🎯 Goal — what you'll have at the end

The four **CloudFormation templates** that describe LTRide's entire AWS infrastructure as code, understood well enough that you could explain each one to a classmate — plus confirmation that AWS itself agrees they're well-formed. Concretely, by the end of this hour you will have:

- Read and understood `deploy/cfn/01-network.yaml`, `02-database.yaml`, `03-compute.yaml`, and `04-dns.yaml`.
- Personalized `03-compute.yaml`'s `RepoUrl` so the server clones **your** fork on first boot, not a placeholder.
- Proven all four templates are valid YAML/CloudFormation using `./deploy.sh validate` — with **zero AWS resources created**.

**✅ Done when (your deliverable checklist):**
- [ ] `cd deploy && ./deploy.sh validate` prints `valid: 01-network.yaml`, `valid: 02-database.yaml`, `valid: 03-compute.yaml`, and `valid: 04-dns.yaml` — no errors, no resources created.
- [ ] You can say, in one sentence each, what `01-network.yaml`, `02-database.yaml`, `03-compute.yaml`, and `04-dns.yaml` create.
- [ ] `deploy/cfn/03-compute.yaml`'s `RepoUrl` points at your own repo's real clone URL, not a leftover placeholder.
- [ ] Your work is committed on branch `cr/d1-cfn-templates` and pushed, PR base = `main`.

---

## 🤔 Why this lesson matters

Up to now, "the backend" has meant code that runs on your laptop. Deploying means renting real computers from Amazon — and the moment you do that by hand (clicking around the AWS Console), you get a "snowflake" server: nobody, including future-you, can remember exactly what buttons were clicked to build it. If it crashes, or you need a second one for testing, you're clicking again and hoping you remember every step.

**CloudFormation** solves this by describing infrastructure the same way you describe an app: as text files in your repo. A "template" is a YAML file that says "I want a network, a database, a server" — and CloudFormation reads it and builds exactly that, every time, identically. This is the **Infrastructure as Code (IaC)** idea: infrastructure becomes reviewable, versioned, and repeatable, just like the Flask code in the backend lessons. Delete everything with `./deploy.sh down` and recreate it byte-for-byte with `./deploy.sh up` — no memory required.

This lesson doesn't ask you to write these templates from scratch (they're already committed, heavily commented, in `deploy/cfn/`) — your job is to **read them closely enough to trust them**, make the one edit every new deployer must make, and prove AWS accepts them before you ever spend a dollar standing up real infrastructure in lesson D2.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **AWS CloudFormation** | Describe AWS resources in a text file ("template"); AWS creates/updates/deletes exactly what it says. | [AWS CloudFormation User Guide](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/Welcome.html) |
| **Infrastructure as Code (IaC)** | Treating servers/networks/databases as versioned text, not manual console clicks. | [AWS: What is IaC?](https://aws.amazon.com/what-is/iac/) |
| **VPC & subnets** | Your own private slice of AWS's network, split into smaller address ranges ("subnets"), often across multiple data centers ("Availability Zones"). | [Amazon VPC User Guide](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html) |
| **EC2** | A virtual computer you rent by the hour. | [EC2 concepts](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html) |
| **RDS** | A managed database server (patching, backups) — here, PostgreSQL. | [Amazon RDS User Guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html) |
| **YAML** | The indentation-based text format CloudFormation templates are written in. | [yaml.org](https://yaml.org/) |
| **Security group** | A firewall attached to a resource: which ports/IPs may connect. | [EC2 security groups](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html) |
| **Secrets Manager** | Where AWS generates and stores the database password so it never appears in plaintext. | [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html) |

---

## ✅ Before you start

**Time budget for the hour:** setup & branch (5 min) → read `01-network.yaml` (10) → read `02-database.yaml` (10) → read `03-compute.yaml` + fix `RepoUrl` (15) → read `04-dns.yaml` (10) → validate & commit (10).

**Open your terminal and make your branch.** This CR depends on nothing in the app itself, so it branches straight off `main`:

```bash
git checkout main
git pull                        # make sure you start from the latest main
git checkout -b cr/d1-cfn-templates   # create + switch to this lesson's branch
```

**What this does & why:** same stacked-CR routine as every backend lesson — isolate this lesson's change on its own branch so it's reviewable as one small unit. → Reference: [Git Branching basics](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).

---

## 🛠 Build it, step by step

> **Two non-obvious rules all four templates follow** (keep these in mind as you read):
> 1. `deploy.sh` passes the **entire** `params/prod.json` to **every** stack, and CloudFormation rejects an override for a parameter a template doesn't declare. So **every template declares all six parameter keys** (`AdminCidr`, `KeyName`, `DomainName`, `HostedZoneId`, `WebInstanceType`, `DbInstanceClass`) — even the ones it doesn't use. Unreferenced parameters are allowed; you'll see `Description: (Unused here)` a lot.
> 2. There's no output→param wiring between stacks, so cross-stack values travel via **`Export`** (one stack publishes a name) and **`Fn::ImportValue`** (another stack reads it) — e.g. the network stack exports `ltride-VpcId`, the compute stack imports `ltride-DbEndpoint`. Rename an export and every importer breaks.

### Step 1 — Read the network stack (~10 min)

Open `deploy/cfn/01-network.yaml`. This is the "plot of land" every other stack builds on: a **VPC**, two **public subnets** in two different Availability Zones (RDS requires at least two AZs, even for one database), an **internet gateway** + route table, and two **security groups**:

```yaml
  WebSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: ltride web server — HTTP/HTTPS from world, SSH from admin
      VpcId: !Ref Vpc
      SecurityGroupIngress:
        - { IpProtocol: tcp, FromPort: 80,  ToPort: 80,  CidrIp: 0.0.0.0/0, Description: HTTP }
        - { IpProtocol: tcp, FromPort: 443, ToPort: 443, CidrIp: 0.0.0.0/0, Description: HTTPS }
        - IpProtocol: tcp
          FromPort: 22
          ToPort: 22
          CidrIp: !Ref AdminCidr
          Description: SSH from admin only

  DbSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: ltride database — Postgres from the web SG only
      VpcId: !Ref Vpc
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 5432
          ToPort: 5432
          SourceSecurityGroupId: !Ref WebSecurityGroup
          Description: Postgres from web tier
```

**Explanation:**
- **`WebSecurityGroup`** — the web server's firewall. Ports `80`/`443` (HTTP/HTTPS) are open to `0.0.0.0/0` (the whole internet, since anyone should reach your website); port `22` (SSH) is open **only** to `!Ref AdminCidr` — your own IP, filled in during D0. → [Security groups](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html).
- **`DbSecurityGroup`** — the database's firewall. Notice it has **no `CidrIp`** — instead `SourceSecurityGroupId: !Ref WebSecurityGroup` means "allow Postgres (`5432`) only from instances that belong to the web security group." Not from the internet, not even from your laptop. This is **least privilege**: the database is reachable from exactly one place, the web server, and nowhere else.
- At the bottom, `Outputs` **exports** `ltride-VpcId`, `ltride-PublicSubnet1/2`, `ltride-WebSecurityGroupId`, and `ltride-DbSecurityGroupId` — the names the other three templates import.

### Step 2 — Read the database stack (~10 min)

Open `deploy/cfn/02-database.yaml`. It provisions the RDS PostgreSQL instance and, crucially, **generates its password without a human ever typing it**:

```yaml
  DbSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: ltride/db
      GenerateSecretString:
        SecretStringTemplate: '{"username":"ltride"}'
        GenerateStringKey: password
        PasswordLength: 24
        ExcludeCharacters: '"@/\ ''`$'

  Database:
    Type: AWS::RDS::DBInstance
    DeletionPolicy: Snapshot
    Properties:
      Engine: postgres
      DBInstanceClass: !Ref DbInstanceClass
      MasterUsername: !Sub '{{resolve:secretsmanager:${DbSecret}:SecretString:username}}'
      MasterUserPassword: !Sub '{{resolve:secretsmanager:${DbSecret}:SecretString:password}}'
      DBSubnetGroupName: !Ref DbSubnetGroup
      VPCSecurityGroups:
        - !ImportValue ltride-DbSecurityGroupId
      PubliclyAccessible: false
```

**Explanation:**
- **`DbSecret`** — a [Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html) resource that asks AWS to invent a random 24-character password and store it, instead of a human choosing and typing one. `ExcludeCharacters` keeps out characters that would break a URL or a shell quote.
- **`{{resolve:secretsmanager:...}}`** — a special CloudFormation syntax that pulls the username/password straight out of Secrets Manager at deploy time. The **actual password never appears** in this template, in `git`, or in CloudFormation's event log — only this resolver reference does.
- **`PubliclyAccessible: false`** — the database has no public IP at all; the only path in is through the security group rule from Step 1.
- **`DeletionPolicy: Snapshot`** — if this stack is ever deleted (`./deploy.sh down`), RDS keeps a final backup instead of destroying your data outright.
- `Outputs` exports `ltride-DbEndpoint` (the hostname the app connects to), `ltride-DbPort`, and `ltride-DbSecretArn` — all three imported by the compute stack next.

### Step 3 — Read the compute stack, and fix `RepoUrl` (~15 min)

Open `deploy/cfn/03-compute.yaml`. This is the EC2 server itself: an **IAM role** scoped to read only the DB secret, the instance, a fixed **Elastic IP**, and a **UserData** script that runs once, as root, the first time the box boots:

```yaml
  InstanceRole:
    Type: AWS::IAM::Role
    Properties:
      Policies:
        - PolicyName: read-db-secret
          PolicyDocument:
            Statement:
              - Effect: Allow
                Action: secretsmanager:GetSecretValue
                Resource: !ImportValue ltride-DbSecretArn
```
```yaml
          UserData:
            Fn::Base64: !Sub
              - |
                #!/bin/bash
                ...
                REPO_URL="${RepoUrl}"
                ...
                sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR"
                ...
              - DbEndpoint:  !ImportValue ltride-DbEndpoint
                RepoUrl: "https://github.com/LTRide2/LTR-Backend.git"
```

**Explanation:**
- **`InstanceRole`** — an [IAM role](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html) is "what the instance is allowed to do." This one grants exactly one permission, `secretsmanager:GetSecretValue`, scoped to exactly the one secret the database stack made (`!ImportValue ltride-DbSecretArn`). If the server is ever compromised, the attacker can't read *other* secrets in your account — least privilege again, same idea as the security group in Step 1.
- **`UserData`** — a shell script CloudFormation hands to a fresh Ubuntu box on first boot. It installs nginx/Python/git, clones the repo, builds a virtualenv, pulls the DB password out of Secrets Manager to write `.env`, installs the systemd + nginx config that ship in `deploy/server/` (covered in the next lesson, D1b), runs any pending SQL migrations, and starts the services. It's the automated version of everything a human would otherwise SSH in and type by hand.
- **`Fn::Sub` with `${RepoUrl}`** — CloudFormation substitutes `${RepoUrl}` with the value below the script before handing it to the instance. Anything in the script that should stay a **literal** `${...}` for the shell (not CloudFormation) has to be escaped as `${!...}` — you'll see that pattern elsewhere in the file.
- **`WebEip`** (Elastic IP) — a fixed public address. Without it, stopping and restarting the instance would hand back a *different* IP and break DNS every time.

**Now make the one required edit.** Find the `RepoUrl:` line near the bottom of the `UserData` block and set it to **your own fork's real clone URL** — the server clones this URL on first boot, so if it's wrong (or still a placeholder), the instance can't fetch any code:

```yaml
RepoUrl: "https://github.com/YOUR_ORG/LTR-Backend.git"
```

### Step 4 — Read the DNS stack (~10 min)

Open `deploy/cfn/04-dns.yaml`. It creates one Route 53 **A record** — the mapping from your domain name to the server's Elastic IP — but only if you actually own a domain yet:

```yaml
Conditions:
  HasHostedZone: !Not [ !Equals [ !Ref HostedZoneId, "Z0123456789ABCDEFGHIJ" ] ]

Resources:
  DnsRecord:
    Type: AWS::Route53::RecordSet
    Condition: HasHostedZone
    Properties:
      HostedZoneId: !Ref HostedZoneId
      Name: !Ref DomainName
      Type: A
      TTL: "300"
      ResourceRecords:
        - !ImportValue ltride-ElasticIp
```

**Explanation:**
- **`Conditions` / `HasHostedZone`** — compares your `HostedZoneId` parameter against the literal placeholder value shipped in `params/prod.json`. While it still equals the placeholder, this condition is `false`.
- **`Condition: HasHostedZone`** on the resource — CloudFormation only creates `DnsRecord` when that condition is `true`. So until you own a domain and fill in a real `HostedZoneId` (lesson D4), this stack simply creates **nothing**, and the rest of your deploy still succeeds. → [CloudFormation Conditions](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/conditions-section-structure.html).
- **`Type: A`, `TTL: "300"`** — an A record maps a hostname straight to an IPv4 address; a 300-second TTL means DNS changes propagate in about 5 minutes while you're still setting things up.

---

## 🧪 Prove it works — testing guide

```bash
cd deploy
./deploy.sh validate
```

**What you should see:** one `valid: <template>.yaml` line per file, in order:
```
==> validating 01-network.yaml
  ✓ valid: 01-network.yaml
==> validating 02-database.yaml
  ✓ valid: 02-database.yaml
==> validating 03-compute.yaml
  ✓ valid: 03-compute.yaml
==> validating 04-dns.yaml
  ✓ valid: 04-dns.yaml
```

**No AWS resources are created by `validate`** — it's a dry check that calls `aws cloudformation validate-template`, which only asks AWS "is this template's syntax and structure well-formed?" It does **not** check your parameter values, IAM permissions to actually create resources, or your account's service limits — that's what `./deploy.sh up` in lesson D2 is for.

---

## 🚀 Save your work (commit & open the CR)

```bash
git add deploy/cfn/03-compute.yaml
git commit -m "D1: point compute stack's RepoUrl at my fork; confirm all four CFN templates validate"
git push -u origin cr/d1-cfn-templates
```

Then open a Pull Request on GitHub with **base = `main`**. Use the CR description template and paste your `./deploy.sh validate` output as the testing evidence. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **`aws cloudformation validate-template` fails with a credentials error** — your AWS CLI isn't configured yet. Go back to D0 and run `aws configure`, or `aws sts get-caller-identity` to confirm you're logged in.
- **`Parameter ... does not exist` or similar** — a template you edited is missing one of the six required parameters (`AdminCidr`, `KeyName`, `DomainName`, `HostedZoneId`, `WebInstanceType`, `DbInstanceClass`). Every template must declare all six, even unused ones.
- **A generic "Template format error"** — YAML is whitespace-sensitive; a stray tab or a misaligned list item is the usual cause. Check the indentation immediately around the line CloudFormation reports.
- **You forgot to change `RepoUrl`** — this won't fail `validate` (it's just a string to CloudFormation), but the server will fail to clone your code on first boot in lesson D2. Double-check it now before you deploy anything.
- **`./deploy.sh validate` hangs or times out** — check `AWS_REGION`/`AWS_PROFILE`; the script defaults to `us-east-1` and whatever profile `aws configure` set up.

---

## 📝 Recap

- You read all four CloudFormation templates that fully describe LTRide's AWS infrastructure — network, database, compute, DNS — as versioned, reviewable text instead of console clicks.
- You saw **least privilege** applied twice: the database's security group only trusts the web tier, and the server's IAM role can read only its own DB secret.
- You saw how a secret (the RDS password) can flow through infrastructure — generated, stored, and resolved — **without ever appearing in plaintext** anywhere in git or the template.
- You learned how stacks talk to each other with `Export` / `Fn::ImportValue`, and how a `Condition` lets a stack safely create nothing until a prerequisite (a real domain) exists.
- You personalized `RepoUrl` and proved all four templates are valid before spending a single dollar standing up real infrastructure.

---

## 📚 References

- [AWS CloudFormation User Guide](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/Welcome.html)
- [AWS: What is Infrastructure as Code?](https://aws.amazon.com/what-is/iac/)
- [Amazon VPC User Guide](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html)
- [Amazon EC2 — concepts](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html)
- [Amazon RDS User Guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html)
- [YAML](https://yaml.org/)
- [EC2 security groups](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html)
- [IAM roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html)
- [CloudFormation Conditions](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/conditions-section-structure.html)
- [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request)
- Source of truth for this lesson: [deployment guide → CR D1](../deployment-guide.md#cr-d1--write-the-cloudformation-templates-the-infrastructure-code).

---

## ➡️ Next lesson

**[Lesson D1b — Server configuration files](D1b-server-config-files.md).** You'll walk through the nginx, gunicorn/systemd, and provisioning files that the compute stack's UserData installs — the pieces that turn a bare Ubuntu box into a working LTRide server. → [source CR](../deployment-guide.md#cr-d1b--server-configuration-files-nginx-gunicornsystemd-provisioning).
