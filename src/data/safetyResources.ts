/** UK support routes for the v0.1 prototype (brief §17.5). */

export interface SupportRoute {
  label: string;
  detail: string;
  action: { type: 'tel' | 'sms' | 'url'; value: string };
}

export const UK_SUPPORT_ROUTES: SupportRoute[] = [
  {
    label: '999 / A&E',
    detail: 'If you or someone else is in immediate danger.',
    action: { type: 'tel', value: '999' },
  },
  {
    label: 'NHS 111',
    detail: 'Urgent health and mental health support.',
    action: { type: 'tel', value: '111' },
  },
  {
    label: 'Samaritans',
    detail: 'Free, any time, day or night — call 116 123.',
    action: { type: 'tel', value: '116123' },
  },
  {
    label: 'Shout',
    detail: 'Text SHOUT to 85258 for free crisis text support.',
    action: { type: 'sms', value: '85258' },
  },
];
