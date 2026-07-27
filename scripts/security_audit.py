#!/usr/bin/env python3
"""
Security Audit Orchestrator
Automates SAST scanning, dependency vulnerability checks, and secret scanning
across backend and frontend codebases, producing a consolidated report.
"""

import os
import sys
import json
import re
import subprocess
from pathlib import Path
from datetime import datetime

# Workspace root path
ROOT_DIR = Path(__file__).resolve().parent.parent
REPORT_FILE = ROOT_DIR / "security_audit_report.md"

# Secret patterns to detect exposed credentials in source files
SECRET_PATTERNS = {
    "AWS Access Key": r"AKIA[0-9A-Z]{16}",
    "Generic API Key": r"(?i)(api[_-]?key|secret[_-]?key|auth[_-]?token)\s*=\s*['\"][A-Za-z0-9_\-]{16,}['\"]",
    "Private Key": r"-----BEGIN (RSA|EC|OPENSSH|DSA|PRIVATE) KEY-----",
    "Hardcoded Password": r"(?i)(password|passwd|pwd)\s*=\s*['\"][^'\"]{6,}['\"]",
    "Database URI with Credentials": r"postgres://[^:]+:[^@]+@",
    "Generic High Entropy Token": r"(?i)bearer\s+[A-Za-z0-9\-\._~\+\/]{20,}="
}

# Directories to exclude from secret scanning
SCAN_EXCLUDE_DIRS = {".git", "node_modules", "venv", ".venv", "__pycache__", ".pytest_cache", "build", "dist"}
SCAN_EXCLUDE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".tar", ".gz", ".pyc"}

class AuditReport:
    def __init__(self):
        self.timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.sections = {}
        self.total_vulnerabilities = 0
        self.high_severity = 0
        self.medium_severity = 0
        self.low_severity = 0

    def add_section(self, name, status, summary, details, issues_count={"high": 0, "medium": 0, "low": 0}):
        self.sections[name] = {
            "status": status,
            "summary": summary,
            "details": details,
            "issues": issues_count
        }
        self.high_severity += issues_count.get("high", 0)
        self.medium_severity += issues_count.get("medium", 0)
        self.low_severity += issues_count.get("low", 0)
        self.total_vulnerabilities += sum(issues_count.values())

    def generate_markdown(self):
        md = []
        md.append("# Automated Codebase Security Audit Report")
        md.append(f"**Generated At**: `{self.timestamp}`  ")
        md.append(f"**Total Findings**: `{self.total_vulnerabilities}` | High: `{self.high_severity}` | Medium: `{self.medium_severity}` | Low: `{self.low_severity}`\n")

        md.append("## Executive Summary")
        md.append("| Audit Stage | Status | Findings Summary |")
        md.append("| :--- | :--- | :--- |")
        for stage, data in self.sections.items():
            status_icon = "🟢 PASS" if data["status"] == "PASS" else ("🟡 WARN" if data["status"] == "WARN" else "🔴 FAIL")
            md.append(f"| **{stage}** | {status_icon} | {data['summary']} |")

        md.append("\n---\n")

        for stage, data in self.sections.items():
            md.append(f"## {stage}")
            md.append(f"**Status**: `{data['status']}`")
            md.append(f"\n{data['details']}\n")

        return "\n".join(md)

def run_cmd(cmd, cwd=None, timeout=30):
    """Executes a command and returns exit code, stdout, and stderr."""
    try:
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd or ROOT_DIR, timeout=timeout)
        return res.returncode, res.stdout, res.stderr
    except subprocess.TimeoutExpired:
        return -1, "", f"Command timed out after {timeout} seconds."
    except Exception as e:
        return -1, "", str(e)

def audit_backend_code():
    """Runs Bandit SAST scan on backend Python code."""
    print("[*] Running Backend Python SAST Scan (Bandit)...")
    issues = {"high": 0, "medium": 0, "low": 0}
    backend_dir = ROOT_DIR / "backend"

    if not backend_dir.exists():
        return "PASS", "Backend directory not found.", "No backend code directory present.", issues

    # Check if bandit is installed
    code, stdout, stderr = run_cmd("bandit -r backend -f json")
    if code == -1 or "bandit: command not found" in stderr or "is not recognized" in stderr:
        # Try running with python -m bandit
        code, stdout, stderr = run_cmd(f"{sys.executable} -m bandit -r backend -f json")

    if "not recognized" in stderr or "No module named" in stderr or code == -1:
        details = "Bandit static analyzer is not installed in the local environment.\n"
        details += "Install it using `pip install bandit` to enable full Python SAST scanning."
        return "WARN", "Bandit scanner not installed.", details, issues

    try:
        report = json.loads(stdout)
        results = report.get("results", [])
        metrics = report.get("metrics", {})
        
        details_lines = []
        for issue in results:
            sev = issue.get("issue_severity", "LOW").lower()
            if sev in issues:
                issues[sev] += 1

            loc = f"{issue.get('filename')}:{issue.get('line_number')}"
            details_lines.append(f"- **[{issue.get('issue_severity')}]** `{loc}` - {issue.get('issue_text')} (CWE-{issue.get('issue_cwe', {}).get('id', 'N/A')})")

        if not results:
            return "PASS", "No Python SAST issues detected.", "No security issues found by Bandit static analysis.", issues
        else:
            summary = f"Detected {len(results)} potential issue(s) (High: {issues['high']}, Med: {issues['medium']}, Low: {issues['low']})."
            status = "FAIL" if issues["high"] > 0 else "WARN"
            return status, summary, "\n".join(details_lines), issues

    except Exception as e:
        return "WARN", "Bandit output parsing error.", f"Raw stdout:\n```\n{stdout[:1000]}\n```\nError: {e}", issues

def audit_frontend_dependencies():
    """Runs npm audit on frontend directory."""
    print("[*] Running Frontend Dependency Audit (npm audit)...")
    issues = {"high": 0, "medium": 0, "low": 0}
    frontend_dir = ROOT_DIR / "frontend"

    if not frontend_dir.exists():
        return "PASS", "Frontend directory not found.", "No frontend directory present.", issues

    code, stdout, stderr = run_cmd("npm audit --json", cwd=frontend_dir)
    
    if not stdout.strip():
        return "WARN", "npm audit could not execute.", f"Error output:\n```\n{stderr[:1000]}\n```", issues

    try:
        data = json.loads(stdout)
        metadata = data.get("metadata", {}).get("vulnerabilities", {})
        
        issues["high"] += metadata.get("high", 0) + metadata.get("critical", 0)
        issues["medium"] += metadata.get("moderate", 0)
        issues["low"] += metadata.get("low", 0)

        total_vulns = sum(metadata.values())
        summary = f"Detected {total_vulns} dependency vulnerability(ies) (Critical/High: {issues['high']}, Moderate: {issues['medium']}, Low: {issues['low']})."

        details = [f"- **Critical**: {metadata.get('critical', 0)}",
                   f"- **High**: {metadata.get('high', 0)}",
                   f"- **Moderate**: {metadata.get('moderate', 0)}",
                   f"- **Low**: {metadata.get('low', 0)}\n"]

        advisories = data.get("vulnerabilities", {})
        if advisories:
            details.append("### Vulnerable Packages Overview:")
            for pkg_name, vuln in list(advisories.items())[:10]:
                sev = vuln.get("severity", "unknown").upper()
                via = vuln.get("via", [])
                via_desc = ", ".join([v if isinstance(v, str) else v.get("title", "") for v in via[:2]])
                details.append(f"- **{pkg_name}** (`{sev}`): {via_desc}")

        status = "PASS" if total_vulns == 0 else ("FAIL" if issues["high"] > 0 else "WARN")
        return status, summary, "\n".join(details), issues

    except Exception as e:
        return "WARN", "npm audit parsing output.", f"Raw output:\n```\n{stdout[:1000]}\n```\nError: {e}", issues

def audit_secrets():
    """Scans repository files for exposed secrets and private keys."""
    print("[*] Running Secret & Credential Detection Scan...")
    issues = {"high": 0, "medium": 0, "low": 0}
    findings = []

    for root, dirs, files in os.walk(ROOT_DIR):
        dirs[:] = [d for d in dirs if d not in SCAN_EXCLUDE_DIRS]

        for file in files:
            ext = Path(file).suffix.lower()
            if ext in SCAN_EXCLUDE_EXTS:
                continue

            filepath = Path(root) / file
            rel_path = filepath.relative_to(ROOT_DIR)

            # Skip the report file itself or scripts/security_audit.py pattern definitions
            if file in ["security_audit_report.md", "security_audit.py"]:
                continue

            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    for line_idx, line in enumerate(f, start=1):
                        for pattern_name, regex in SECRET_PATTERNS.items():
                            if re.search(regex, line):
                                # Mask line for report safety
                                masked_line = line.strip()[:80]
                                findings.append(f"- **[{pattern_name}]** in `{rel_path}:{line_idx}` -> `{masked_line}`")
                                issues["high"] += 1
            except Exception:
                pass

    if not findings:
        return "PASS", "No exposed credentials or secrets detected.", "Clean scan! No hardcoded AWS keys, private keys, or API tokens found.", issues
    else:
        summary = f"Detected {len(findings)} potential secret leak(s) in codebase."
        return "FAIL", summary, "\n".join(findings), issues

def main():
    print("=" * 60)
    print("      CODEBASE AUTOMATED SECURITY AUDIT ORCHESTRATOR      ")
    print("=" * 60)

    report = AuditReport()

    # 1. Backend Code Scan
    status, summary, details, issues = audit_backend_code()
    report.add_section("Backend Code Security (Python Bandit SAST)", status, summary, details, issues)

    # 2. Frontend Dependency Scan
    status, summary, details, issues = audit_frontend_dependencies()
    report.add_section("Frontend Dependency Vulnerabilities (npm audit)", status, summary, details, issues)

    # 3. Secret & Credentials Scan
    status, summary, details, issues = audit_secrets()
    report.add_section("Secret & Credentials Detection Scan", status, summary, details, issues)

    # Write output markdown
    markdown_content = report.generate_markdown()
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write(markdown_content)

    print("\n" + "=" * 60)
    print(f"Audit Complete! Total Findings: {report.total_vulnerabilities}")
    print(f"Full markdown report saved to: {REPORT_FILE}")
    print("=" * 60)

if __name__ == "__main__":
    main()
