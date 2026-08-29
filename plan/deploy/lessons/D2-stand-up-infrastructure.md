# Lesson D2 — Stand up the infrastructure

> **Track:** Deploy · **Lesson 4 of 6**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** gentle-but-nervy (no new code today — you're running real commands against real AWS, and the RDS wait genuinely takes 10–15 minutes).
> **🧩 Prerequisites:** you've done [Lesson D1b — Server configuration files](D1b-server-config-files.md); D0 is complete (AWS CLI configured, SSH key created) and D1's four templates validate.
> **🌿 CR branch:** `cr/d2-provision` (off D1's branch, `cr/d1-cfn-templates`) — this CR is mostly running the scripts D1 wrote; the only "code" you might touch is a small template fix if a stack fails. **📄 Source CR:** [deployment guide → CR D2](../deployment-guide.md#cr-d2--stand-up-the-infrastructure) · **🗺 Big picture:** [plan.md §10](../../plan.md#10-aws-deployment--ec2--rds-via-cloudformation).

---

## 🎯 Goal — what you'll have at the end

A **real network, database, and server running in AWS** — the actual cloud infrastructure your CloudFormation templates (D1) and server config files (D1b) have been describing on paper. Concretely, by the end of this hour you will have:

- All four CloudFormation stacks (`01-network`, `02-database`, `03-compute`, `04-dns`) created and reporting `CREATE_COMPLETE`.
- A live EC2 instance with a fixed public **Elastic IP**, and a live **RDS PostgreSQL** database, both provisioned automatically by the templates.
- The database password generated and stored in **Secrets Manager** — you never typed or saw it.
- Proof you can **SSH into the running server**.

**✅ Done when (your deliverable checklist):**
- [ ] `./deploy.sh status` shows every stack as `CREATE_COMPLETE`.
- [ ] `./deploy.sh outputs` prints a live **EC2 public IP** and an **RDS endpoint**.
- [ ] `ssh -i ~/.ssh/ltride-key.pem ubuntu@<ElasticIp>` logs you into the server (`exit` to leave).
- [ ] You know how to run `./deploy.sh down` to tear it all back down when you're done for the day.

---

## 🤔 Why this lesson matters

Every lesson before this one was **describing** infrastructure in YAML or shell script — no AWS bill, no risk. This lesson is different: `./deploy.sh up` actually asks Amazon to create a computer and a database, and Amazon starts charging you the moment they exist. With the default settings this repo ships (`t3.micro` EC2, `db.t3.micro` RDS), that's a **few dollars a month** — see the full breakdown in the deployment guide's [monthly cost estimate](../deployment-guide.md#b13-monthly-cost-estimate-c6g4xlarge) (the "minimum" ≈ $31/mo scenario is the one that matches these defaults). Nothing here will bankrupt a student project, but only if you remember the other half of this lesson: **you can turn it all off**.

`./deploy.sh down` deletes every stack — the EC2 instance, the RDS database, the networking — so nothing keeps billing while you sleep or between study sessions. RDS keeps a final snapshot on the way out, so you don't lose your data; you can recreate everything with `./deploy.sh up` whenever you pick the project back up. This "spin it up, prove it works, spin it down" rhythm is exactly the habit D0 asked you to set a billing alarm for — this is the lesson where that habit gets exercised for real.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **CloudFormation stack** | One deployed, running copy of a CloudFormation template — the actual AWS resources it created, tracked as a single unit you can update or delete together. | [AWS docs: What is a stack?](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/stacks.html) |
| **`aws cloudformation deploy`** | The CLI command `deploy.sh` calls for you: creates a stack if it doesn't exist yet, or updates it in place if it does. | [AWS CLI reference: `cloudformation deploy`](https://docs.aws.amazon.com/cli/latest/reference/cloudformation/deploy.html) |
| **Stack dependencies & order** | Some stacks need values from another stack before they can exist (e.g. the compute stack needs the network stack's VPC id). `deploy.sh` creates them in a fixed order, and stacks hand values to each other via `Export` / `Fn::ImportValue`. | [CloudFormation: Cross-stack references](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/walkthrough-crossstackref.html) |
| **Elastic IP** | A fixed public IPv4 address you own, attached to your EC2 instance so its address never changes — even across a reboot. | [AWS docs: Elastic IP addresses](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-eip.html) |
| **RDS (Relational Database Service)** | AWS's managed PostgreSQL — Amazon handles the OS, patching, and backups for you. | [AWS docs: What is Amazon RDS?](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html) |
| **Secrets Manager** | Where AWS generates and stores the database password, so it's never written in plaintext anywhere — not in a template, not in this repo. | [AWS docs: What is Secrets Manager?](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html) |

---

## ✅ Before you start

**Prerequisites:** D0 done (AWS CLI configured, `~/.ssh/ltride-key.pem` in place); D1's four templates pass `./deploy.sh validate`; D1b's server config files are in `deploy/server/`.

**Time budget for the hour:** branch + preflight (5 min) → kick off `./deploy.sh up` and wait for RDS (10–15 min, mostly waiting) → watch `./deploy.sh status` (5 min, overlaps with the wait) → `./deploy.sh outputs` + SSH proof (10 min) → read this lesson's troubleshooting section so you recognize a stack failure if one happens (10 min) → decide whether to leave it running or `./deploy.sh down` (5 min buffer).

**Make your branch**, stacked off D1's branch:

```bash
git checkout cr/d1-cfn-templates
git pull
git checkout -b cr/d2-provision
```

**What this does & why:** this CR branches off `cr/d1-cfn-templates`, not `main`, because you need D1's four template files present to run any of today's commands. → Reference: [Git Branching basics](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).

---

## 🛠 Build it, step by step

### Step 1 — Create everything with one command (~15 min, mostly waiting)

```bash
cd ~/workspace/LTR-Backend/deploy
./deploy.sh up
```

**What this does & why:** `up` first re-runs the same `validate` check from D1, then calls `aws cloudformation deploy` on each of the four templates **in order** — network, then database, then compute, then DNS — because each later stack imports values (like the VPC id) that an earlier one exports. This single command is what actually creates your EC2 instance and RDS database in AWS. → Reference: [`aws cloudformation deploy`](https://docs.aws.amazon.com/cli/latest/reference/cloudformation/deploy.html).

This step is slow **on purpose** — RDS provisioning a new database instance genuinely takes 10–15 minutes. That's normal; don't cancel it.

### Step 2 — Watch the stacks come up (~5 min, while Step 1 runs)

In a second terminal tab:

```bash
./deploy.sh status
```

**What this does & why:** calls `aws cloudformation describe-stacks` and prints each stack's current status. You're watching for every stack to move from `CREATE_IN_PROGRESS` to **`CREATE_COMPLETE`**. → Reference: [CloudFormation stack status codes](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-describing-stacks.html).

> **If a stack shows `ROLLBACK_COMPLETE` or `CREATE_FAILED` instead:** open the AWS Console → **CloudFormation** → click the failed stack → **Events** tab. The first red row is the real error (often a bad parameter or a name collision). Fix the template, then just re-run `./deploy.sh up` — it updates in place, it doesn't start over. → Reference: [Viewing CloudFormation stack events](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-viewing-stack-events.html).

### Step 3 — Grab the live addresses (~5 min)

```bash
./deploy.sh outputs
```

**What this does & why:** prints the values the templates exported as `Outputs` — most importantly your EC2 instance's **Elastic IP** and your **RDS endpoint** (the database's connection address). You'll need the Elastic IP for the SSH check below, and again in lessons D3 and D4. → Reference: [Elastic IP addresses](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-eip.html) · [Connecting to an RDS instance](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ConnectToPostgreSQLInstance.html).

Behind the scenes, `03-compute.yaml`'s UserData already used the RDS endpoint and a password AWS generated in **Secrets Manager** to write the server's `.env` file on first boot — you never typed a database password anywhere. → Reference: [What is Secrets Manager?](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html).

---

## 🧪 Prove it works — testing guide

**Setup:** D0 complete; D1's templates valid.

**Steps:**

```bash
./deploy.sh up
./deploy.sh status
./deploy.sh outputs
ssh -i ~/.ssh/ltride-key.pem ubuntu@<ElasticIp-from-outputs>
```

**Expected:**
1. All four stacks eventually read `CREATE_COMPLETE` in `./deploy.sh status`.
2. `./deploy.sh outputs` prints a real public IP address (your Elastic IP) and an RDS endpoint hostname.
3. The `ssh` command logs you straight into the server without a password prompt (the key pair from D0 handles authentication). Type `exit` to leave.

> 💸 **Cost control:** once you've proven all of the above, if you're done for the day and don't need the server live, run `./deploy.sh down` to delete everything (RDS keeps a final snapshot). Re-create anytime with `./deploy.sh up`.

---

## 🚀 Save your work (commit & open the CR)

There's usually no code to change in this CR — but if you had to tweak a template to fix a `CREATE_FAILED` stack, commit that fix:

```bash
git add deploy/cfn/
git commit -m "D2: fix to <template> found while standing up the infrastructure"
git push -u origin cr/d2-provision
```

Open a Pull Request with **base = `cr/d1-cfn-templates`**. In the CR description, paste your "Prove it works" output — the `CREATE_COMPLETE` statuses, the outputs, and confirmation you could SSH in — as the testing evidence. The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **A stack shows `CREATE_FAILED` or rolls back** — AWS Console → CloudFormation → click the stack → **Events** tab; the first red row names the exact resource and reason. Fix the template and re-run `./deploy.sh up`.
- **`AccessDenied` / `UnauthorizedOperation` errors** — your IAM user (from D0) is missing a permission for that AWS service. If you attached `AdministratorAccess` in D0 this shouldn't happen; double-check you ran `aws configure` with the IAM user's keys, not an old/expired pair.
- **Resources you know you created "don't exist"** — check your region: `aws configure list`. This project's templates assume `us-east-1`; a mismatched region makes everything look missing.
- **Stuck at `CREATE_IN_PROGRESS` far longer than 15 minutes** — RDS is usually the slow one; give it time. If it's been 30+ minutes, check the Events tab for a real error rather than assuming it's still working.
- **`InsufficientInstanceCapacity` or a service-quota error** — rare for `t3.micro`/`db.t3.micro`, but possible on a brand-new account. Check [AWS Service Quotas](https://docs.aws.amazon.com/servicequotas/latest/userguide/intro.html) for the affected service, or try again in a few minutes — AWS capacity errors are usually transient.

---

## 📝 Recap

- You ran `./deploy.sh up`, which called `aws cloudformation deploy` on all four templates in dependency order, and watched them reach `CREATE_COMPLETE` with `./deploy.sh status`.
- You pulled the live **Elastic IP** and **RDS endpoint** out of `./deploy.sh outputs`, and used the IP to **SSH into your real server**.
- You saw that the database password never touched your terminal or this repo — **Secrets Manager** generated and stored it, and the server's UserData read it directly.
- You practiced the cost habit this whole track depends on: stand it up to prove it works, tear it down with `./deploy.sh down` when you're not using it.

---

## 📚 References

- [AWS docs: What is a stack?](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/stacks.html)
- [AWS CLI reference: `cloudformation deploy`](https://docs.aws.amazon.com/cli/latest/reference/cloudformation/deploy.html)
- [CloudFormation: Cross-stack references](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/walkthrough-crossstackref.html)
- [CloudFormation: Viewing stack events](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-viewing-stack-events.html) and [describing stacks](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-describing-stacks.html)
- [AWS docs: Elastic IP addresses](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-eip.html)
- [AWS docs: What is Amazon RDS?](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html) and [Connecting to a PostgreSQL RDS instance](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ConnectToPostgreSQLInstance.html)
- [AWS docs: What is Secrets Manager?](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html)
- [AWS Service Quotas](https://docs.aws.amazon.com/servicequotas/latest/userguide/intro.html)
- Source of truth for this lesson: [deployment guide → CR D2](../deployment-guide.md#cr-d2--stand-up-the-infrastructure).

---

## ➡️ Next lesson

**[Lesson D3 — Release the application code](D3-release-application-code.md).** You'll put your actual backend and frontend onto the running server with `release.sh`. → [source CR](../deployment-guide.md#cr-d3--release-the-application-code).
