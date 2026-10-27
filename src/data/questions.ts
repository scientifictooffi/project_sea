import type { PublicQuestion } from '../lib/types'

/**
 * PUBLIC question content only. Correct answers and explanations live on the
 * server (supabase/migrations + Edge Function) and are never shipped here.
 * This copy is used by the local mock mode and as the display fallback.
 */
export const PUBLIC_QUESTIONS: PublicQuestion[] = [
  {
    id: 1,
    order: 1,
    prompt: "What was one of the main causes of the Aral Sea's disappearance?",
    options: [
      'A sudden shift in the regional climate during the 1960s',
      'Water diverted from rivers for agricultural irrigation',
      'Earthquakes that opened cracks in the seabed',
      'Overfishing that collapsed the lake ecosystem',
    ],
    image: '/images/satellite.jpg',
    imageCaption: 'Exhibit A. NASA Earth Observatory, 1989 (left) and 2014 (right).',
    evidenceLabel: 'Exhibit A · Satellite record',
  },
  {
    id: 2,
    order: 2,
    prompt: 'What do satellite images reveal about the Aral Sea?',
    options: [
      'Its surface area shrank dramatically',
      'It slowly migrated northwards',
      'It became deeper but narrower',
      'Its water turned green from algae only',
    ],
    image: '/images/kokaral.jpg',
    imageCaption: 'Exhibit B. Sentinel-2 true colour, 2021. European Space Agency.',
    evidenceLabel: 'Exhibit B · Orbital evidence',
  },
  {
    id: 3,
    order: 3,
    prompt: "What was one major consequence of the sea's decline for local communities?",
    options: [
      'A boom in tourism along the new shoreline',
      'Job losses and the decline of fishing communities',
      'Cheaper electricity from new hydro plants',
      'Larger harvests thanks to a milder climate',
    ],
    image: '/images/seabed.jpg',
    imageCaption: 'Exhibit C. Fishing boats stranded on the former seabed. Photo: Aliyaassubayeva, CC BY-SA 4.0.',
    evidenceLabel: 'Exhibit C · Field evidence',
  },
  {
    id: 4,
    order: 4,
    prompt: 'Which project helped improve conditions in the North Aral Sea?',
    options: [
      'Redirecting the Volga river into the basin',
      'Desalination plants on the eastern shore',
      'The construction of the Kok-Aral Dam',
      'Cloud seeding over the Kyzylkum desert',
    ],
    image: '/images/ships.jpg',
    imageCaption: 'Exhibit D. The ship graveyard at Moynaq. Photo: Arian Zwegers, CC BY 2.0.',
    evidenceLabel: 'Exhibit D · Witness material',
  },
  {
    id: 5,
    order: 5,
    prompt: 'Which approach creates the most reliable digital environmental investigation?',
    options: [
      'Relying on a single dramatic photograph',
      'Using only anonymous social media posts',
      'Combining verified data, documentary images, and interactive storytelling',
      'Avoiding data so the story stays emotional',
    ],
    evidenceLabel: 'Final question · Method',
  },
]
