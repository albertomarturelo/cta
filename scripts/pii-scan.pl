#!/usr/bin/env perl
# Sensitive-data scanner for a public repo (ADR-009).
# Reads text on STDIN in "unified diff" form (only added lines are scanned) or,
# with --plain, as plain text (commit messages, PR bodies). Prints findings with
# the value MASKED — this script must never echo a secret it found.
# Exit: 0 clean or warnings only · 1 at least one FAIL.
use strict; use warnings;

my $plain = grep { $_ eq '--plain' } @ARGV;
my ($label) = map { /^--label=(.*)$/ ? $1 : () } @ARGV; $label //= 'stdin';

# Synthetic values allowed anywhere (Mod-11-valid test RUTs, project contacts).
my %allow_rut = map { $_ => 1 } qw(111111111 12345670K 200000420);
my @allow_email = (qr/^amarturelo\@gmail\.com$/i, qr/\@users\.noreply\.github\.com$/i,
                   qr/^noreply\@/i, qr/\@example\.(com|cl|org)$/i);
if (open my $fh, '<', '.pii-allowlist') {
  while (<$fh>) { chomp; s/#.*//; s/\s+//g; next unless length;
    if (/\@/) { push @allow_email, qr/^\Q$_\E$/i } else { (my $r = uc $_) =~ s/[.\-]//g; $allow_rut{$r} = 1 } }
}

sub mask { my $v = shift; return length($v) <= 4 ? '****' : substr($v,0,2) . ('*' x (length($v)-4)) . substr($v,-2) }
sub dv { my $body = shift; my ($s,$m) = (0,2);
  for my $d (reverse split //, $body) { $s += $d*$m; $m = $m == 7 ? 2 : $m+1 }
  my $r = 11 - ($s % 11); return $r == 11 ? '0' : $r == 10 ? 'K' : "$r" }

my ($file, $line, $fails, $warns) = ('', 0, 0, 0);
sub report { my ($lvl,$cat,$val) = @_; ($lvl eq 'FAIL') ? $fails++ : $warns++;
  printf "%-4s %-16s %s:%s  %s\n", $lvl, $cat, ($file || $label), $line, mask($val) }

while (my $raw = <STDIN>) {
  my $text;
  if ($plain) { $line++; $text = $raw }
  else {
    if ($raw =~ m{^\+\+\+ b/(.*)$}) { $file = $1; $line = 0; next }
    if ($raw =~ /^@@ -\d+(?:,\d+)? \+(\d+)/) { $line = $1 - 1; next }
    if ($raw =~ /^diff --git a\/\S+ b\/(\S+)/) {
      my $f = $1;
      if ($f =~ m{(^|/)\.cta/|(^|/)\.env(\.|$)|\.har$|\.pfx$|\.p12$}) { $file = $f; $line = 0; report('FAIL','forbidden-file',$f) }
      next }
    next if $raw =~ /^(---|\+\+\+)/;
    if ($raw =~ /^\+(.*)/s) { $line++; $text = $1 } elsif ($raw =~ /^ /) { $line++; next } else { next }
    next if $file =~ m{^scripts/pii-scan\.pl$|^\.pii-allowlist$};
  }

  # 1. Chilean RUTs with a valid check digit that are not synthetic.
  while ($text =~ /(?<![\d.])(\d{1,2}\.?\d{3}\.?\d{3})-([\dkK])(?![\dA-Za-z])/g) {
    my ($b,$d) = ($1, uc $2); (my $n = $b) =~ s/\.//g;
    next unless dv($n) eq $d; next if $allow_rut{"$n$d"};
    report('FAIL','rut',"$n-$d") }
  # 2. Email addresses outside the allowlist.
  while ($text =~ /([A-Za-z0-9._%+-]+\@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g) {
    my $e = $1; next if grep { $e =~ $_ } @allow_email; report('FAIL','email',$e) }
  # 3. Secrets: JWTs, cookie headers, credential assignments, private keys.
  report('FAIL','jwt',$1) while $text =~ /(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*)/g;
  report('FAIL','cookie-header',$1) if $text =~ /\b(?:Set-)?Cookie:\s*([^\s;]+=[^\s;]{6,})/i;
  report('FAIL','credential',$1) while $text =~ /\b(?:password|passwd|clave|secret|token|api[_-]?key)\b\s*[:=]\s*["']([^"'\s]{6,})["']/gi;
  report('FAIL','private-key','-----BEGIN') if $text =~ /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
  # 4. Looks like real banking data — warn, a human decides.
  while ($text =~ /\$\s?(\d{1,3}(?:\.\d{3}){2,})(?![\d])/g) { report('WARN','clp-amount',$1) }
  while ($text =~ /(?<![\d\/.-])(\d{2,3}-\d{5,8}-\d{1,3}|\d{9,14})(?![\d\/.-])/g) {
    my $v = $1; next if $v =~ /^20\d{6}$/; report('WARN','account-number?',$v) }
}
print "\n$label: $fails FAIL, $warns WARN\n";
exit($fails ? 1 : 0);
