# Deploy lessons — put the app on the internet, one hour at a time

This folder turns the [Deployment Guide](../deployment-guide.md) into **6 self-contained, ~1-hour lessons**, one per CR (D0 → D4). Each lesson is written for a **high-school beginner**: it states a clear deliverable, explains *why* and *how*, shows every command/config snippet with a plain-language explanation and a reference link, gives you a testing guide to prove it works, and ends with how to save your work / tear down safely.

> **How the lessons relate to the guide:** the guide is the reference (the "what"); each lesson is the hour-long, hand-held walkthrough (the "how + why"). A lesson never invents steps — it expands the matching CR section of the guide. When in doubt, the [guide](../deployment-guide.md) is the source of truth.
>
> **💸 These lessons spend real money.** Standing up AWS resources costs a few dollars while they run. Every lesson tells you how to check cost and how to tear things down (`./deploy.sh down`). See the [cost model in Part 3](../deployment-guide.md#part-3--reference-architecture-iac--cost-model).
>
> **Do the backend (and ideally the frontend) first** — you're deploying the app you built in the [Backend](../../backend/lessons/README.md) and [UI](../../ui/lessons/README.md) tracks.

## Do them in order

| # | Lesson | What you'll have done | Source CR |
|---|---|---|---|
| 1 | [D0 — One-time AWS account setup](D0-aws-account-setup.md) | An AWS account + CLI configured, billing alarms on | [D0](../deployment-guide.md#d0--one-time-aws-account-setup-not-a-code-cr-but-do-it-once) |
| 2 | [D1 — Write the CloudFormation templates](D1-cloudformation-templates.md) | Validated infrastructure-as-code (network/db/compute/dns) | [CR D1](../deployment-guide.md#cr-d1--write-the-cloudformation-templates-the-infrastructure-code) |
| 3 | [D1b — Server configuration files](D1b-server-config-files.md) | nginx + gunicorn/systemd + provisioning files | [CR D1b](../deployment-guide.md#cr-d1b--server-configuration-files-nginx-gunicornsystemd-provisioning) |
| 4 | [D2 — Stand up the infrastructure](D2-stand-up-infrastructure.md) | A live EC2 box + RDS database (real IP) | [CR D2](../deployment-guide.md#cr-d2--stand-up-the-infrastructure) |
| 5 | [D3 — Release the application code](D3-release-application-code.md) | Your backend + frontend running on the server | [CR D3](../deployment-guide.md#cr-d3--release-the-application-code) |
| 6 | [D4 — Domain + Route 53 + HTTPS](D4-domain-route53-https.md) | The site live at `https://your-domain` with a valid cert | [CR D4](../deployment-guide.md#cr-d4--buy-a-domain-wire-it-to-route-53-and-turn-on-https) |

## What each lesson contains

🎯 Goal + a "Done when" deliverable checklist · 🤔 Why it matters · 🧠 Concepts (with links) · ✅ Prereqs + a minute-by-minute time budget · 🛠 Step-by-step (commands/config + explanation + references) · 🧪 Testing guide · 🚀 Save your work / tear down · 🧯 Troubleshooting · 📝 Recap · 📚 References · ➡️ Next lesson.

## After deploying

Keep the live site healthy with the [Deployment Guide → Part 2 (operating & troubleshooting)](../deployment-guide.md#part-2--operating--troubleshooting-the-live-server). The runnable scripts/templates these lessons drive live in the repo-root [`deploy/`](../../../deploy/README.md) folder. Big picture: [plan.md §10](../../plan.md#10-aws-deployment--ec2--rds-via-cloudformation).
