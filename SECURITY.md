# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration stores and exchanges:

- `/data/cache.json`: the last answer of the Bordeaux Métropole open data (the bridge closures: public
  data), and `/data/triggers.json`: the last instant the scene triggers were checked and the events
  already fired. Nothing personal, no secret: the integration asks for no account, no password and no
  API key. The language is kept in the Gladys configuration.
- Network: HTTPS requests to `opendata.bordeaux-metropole.fr` only, without any identifier, two an hour
  (six an hour at most after failures).

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy))
and the open data portal of Bordeaux Métropole.
