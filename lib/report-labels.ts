// Display updated wording without changing saved slide identifiers or image-section bindings.
export function sectionLabel(value:string){return value.replaceAll('주요 추진 실적','추진현황').replaceAll('추진실적','추진현황').replaceAll('추진 실적','추진현황');}
