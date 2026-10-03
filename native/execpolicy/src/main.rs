//! A bounded JSON adapter to the pinned Codex Starlark implementation.
//! Rules never receive host I/O globals. The parent enforces a process deadline.
use codex_execpolicy::{MatchOptions, PolicyParser};
use codex_execpolicy::rule::{PatternToken, PrefixRule, RuleMatch};
use serde::Deserialize;
use serde_json::{Value, json};
use std::io::{self, Read, Write};

const REVISION: &str = "a956835d020762cb2b570053af06f643a11c0ecc";
const MAX_INPUT_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Source {
    name: String,
    source: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    sources: Vec<Source>,
    #[serde(default)]
    commands: Vec<Vec<String>>,
}

fn run() -> Result<Value, Box<dyn std::error::Error>> {
    let mut bytes = Vec::new();
    io::stdin().take(MAX_INPUT_BYTES + 1).read_to_end(&mut bytes)?;
    if bytes.len() as u64 > MAX_INPUT_BYTES {
        return Err("Rule request exceeds the byte limit".into());
    }
    let request: Request = serde_json::from_slice(&bytes)?;
    let mut parser = PolicyParser::new();
    for source in &request.sources {
        parser.parse(&source.name, &source.source)?;
    }
    let policy = parser.build();
    let options = MatchOptions { resolve_host_executables: true };
    let matches: Vec<Vec<Value>> = request.commands.iter().map(|command| {
        policy.matches_for_command_with_options(command, None, &options)
            .into_iter().map(|matched| {
                let RuleMatch::PrefixRuleMatch {
                    matched_prefix, decision, resolved_program, justification,
                } = matched else { unreachable!("No heuristic fallback is configured") };
                json!({
                    "matchedPrefix": matched_prefix, "decision": decision,
                    "resolvedProgram": resolved_program, "justification": justification,
                })
            }).collect()
    }).collect();
    let mut rules = Vec::new();
    for (_, entries) in policy.rules().iter_all() {
        for entry in entries {
            if let Some(rule) = entry.as_any().downcast_ref::<PrefixRule>() {
                let mut pattern = vec![json!(rule.pattern.first.as_ref())];
                pattern.extend(rule.pattern.rest.iter().map(|token| match token {
                    PatternToken::Single(value) => json!(value),
                    PatternToken::Alts(values) => json!(values),
                }));
                let mut value = json!({"pattern": pattern, "decision": rule.decision});
                if let Some(reason) = &rule.justification {
                    value["justification"] = json!(reason);
                }
                rules.push(value);
            }
        }
    }
    // The upstream map's iteration order is unspecified; normalize only exported metadata.
    rules.sort_by_key(Value::to_string);
    let (allowed_domains, denied_domains) = policy.compiled_network_domains();
    let network_rules: Vec<Value> = policy.network_rules().iter().map(|rule| json!({
        "host": rule.host, "protocol": rule.protocol.as_policy_string(),
        "decision": rule.decision, "justification": rule.justification,
    })).collect();
    Ok(json!({
        "revision": REVISION, "rules": rules, "matches": matches,
        "allowedDomains": allowed_domains, "deniedDomains": denied_domains,
        "networkRules": network_rules, "hostExecutables": policy.host_executables(),
    }))
}

fn main() {
    match run() {
        Ok(value) => {
            let mut output = io::stdout().lock();
            if serde_json::to_writer(&mut output, &value).is_err()
                || output.write_all(b"\n").is_err()
            {
                std::process::exit(1);
            }
        }
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    }
}
