/**
 * Visitor-facing display name for a live-chat agent: full first name plus the
 * initial of the surname, e.g. "Ahmet Efeoğlu" -> "Ahmet E.", "Ayça Nur" ->
 * "Ayça N.". Internal records/dashboards keep the full name; only the widget
 * (and other visitor-facing surfaces) get this masked form so the agent's
 * surname is not exposed to customers.
 *
 * Rules:
 *   - trims and collapses whitespace
 *   - single token          -> the token as-is ("Ahmet" -> "Ahmet")
 *   - two or more tokens     -> first token + " " + last token initial + "."
 *   - empty / nullish        -> undefined (caller falls back to a generic label)
 */
export function formatAgentPublicName(
    fullName: string | null | undefined,
): string | undefined {
    if (!fullName) return undefined;
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return undefined;
    if (parts.length === 1) return parts[0];
    const first = parts[0];
    const surnameInitial = parts[parts.length - 1].charAt(0).toLocaleUpperCase('tr-TR');
    return `${first} ${surnameInitial}.`;
}
