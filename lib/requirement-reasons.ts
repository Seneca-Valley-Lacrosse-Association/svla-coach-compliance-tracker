import type { Level, Requirement } from './types'

/**
 * Starting "why we require this" content for the built-in requirements.
 * A requirement's own why, source and level (edited by the board on the Requirements page)
 * always win. These defaults only fill gaps, so the explanation shows before anyone edits it.
 * DRAFT: the board should confirm the source wording, especially the items marked "to confirm".
 */
export interface Reason {
  level: Level
  why: string
  source: string
  sourceUrl?: string
}

export const DEFAULT_REASONS: Record<string, Reason> = {
  'pa-child-abuse': {
    level: 'both',
    why: 'Pennsylvania requires adults who have regular contact with children to clear a child abuse history check. It protects the players and SVLA.',
    source: 'PA Child Protective Services Law (23 Pa.C.S. § 6344.2). High school coaches also file it with Seneca Valley as employees (Act 151).',
  },
  'pa-state-police': {
    level: 'both',
    why: 'This is the state criminal record check that goes with the child abuse clearance. It is required before you work with players.',
    source: 'PA Child Protective Services Law (23 Pa.C.S. §§ 6344, 6344.2). PIAA also requires it for high school coaches.',
  },
  'fbi-fingerprint': {
    level: 'both',
    why: 'The federal check covers records from outside Pennsylvania. Volunteers who have lived in PA for 10 years may sign a disclosure statement instead. Paid coaches must be fingerprinted.',
    source: 'PA Child Protective Services Law (23 Pa.C.S. § 6344). PIAA also requires it for high school coaches.',
  },
  'usal-membership': {
    level: 'both',
    why: 'USA Lacrosse membership connects you to the league insurance coverage and the rules of play SVLA teams use.',
    source: 'USA Lacrosse program and insurance requirement (to confirm with the SVLA insurance carrier).',
    sourceUrl: 'https://www.usalacrosse.com/membership',
  },
  'usal-background': {
    level: 'youth',
    why: 'WPYLA requires every youth coach to pass the USA Lacrosse background screen. It is separate from the Pennsylvania clearances and does not replace them. It must be renewed every 2 years.',
    source: 'WPYLA League Rules, section 6 (Coaches Rosters). Not required for high school coaches.',
  },
  'usal-bronze': {
    level: 'youth',
    why: 'WPYLA requires every youth coach to complete USA Lacrosse training, and each team must have at least one Bronze-certified coach to be eligible to play. Bronze is the USA Lacrosse baseline training, including abuse prevention, concussion and cardiac care. You complete it once and it does not expire.',
    source: 'WPYLA League Rules, section 6 (Coaches Rosters). Not required for high school coaches.',
  },
  concussion: {
    level: 'both',
    why: 'Coaches must be able to spot a concussion and know to remove a player from play. It is retaken every school year.',
    source: 'SVLA safety policy for youth programs. PIAA requires an approved concussion course each year for high school coaches (to confirm which course PIAA accepts).',
    sourceUrl: 'https://www.piaa.org/',
  },
  'sudden-cardiac': {
    level: 'both',
    why: 'Coaches must know the warning signs of sudden cardiac arrest and what to do. It is retaken every school year.',
    source: 'SVLA safety policy for youth programs. PIAA requires annual sudden cardiac arrest training for high school coaches.',
    sourceUrl: 'https://www.piaa.org/',
  },
  handbook: {
    level: 'both',
    why: 'Every coach agrees to the same expectations on conduct, safety and communication with families.',
    source: 'SVLA board policy.',
  },
  contract: {
    level: 'both',
    why: 'Paid coaches have a written agreement covering pay, duties and conduct. It is the employment record for the season.',
    source: 'SVLA board policy for paid coaches.',
  },
  'cpr-first-aid': {
    level: 'both',
    why: 'Optional extra. Head coaches who hold CPR and first aid can respond faster in an emergency.',
    source: 'SVLA recommendation, not a rule.',
  },
}

export interface ResolvedReason extends Reason {
  /** True when the board has not written a reason and the built-in draft is shown. */
  isDefault: boolean
}

export function reasonFor(req: Requirement): ResolvedReason | null {
  const fallback = DEFAULT_REASONS[req.id]
  const why = req.why?.trim() || fallback?.why
  if (!why) return null
  return {
    level: req.level ?? fallback?.level ?? 'both',
    why,
    source: req.source?.trim() || fallback?.source || '',
    sourceUrl: req.sourceUrl?.trim() || fallback?.sourceUrl,
    isDefault: !req.why?.trim(),
  }
}
