// Minimal, XSS-safe markdown for message bodies: escape first, then apply a
// small set of inline rules. Used with {@html}.
export function renderMarkdown(text: string): string {
	let s = text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
	s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
	s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
	s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
	s = s.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
	s = s.replace(
		/\bhttps?:\/\/[^\s<]+/g,
		(u) => `<a href="${u}" target="_blank" rel="noreferrer">${u}</a>`,
	);
	return s.replace(/\n/g, "<br>");
}
