export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      audience,
      selectedScenario,
      detectedScenario,
      finalScenario,
      situation,
      tone,
      length,
      senderName,
      recipientName,
      requestedOutputLanguage
    } = req.body || {};

    if (!situation) {
      return res.status(400).json({ error: 'Missing situation' });
    }

    const scenarioGuidanceMap = {
      'General follow-up': 'Keep the email neutral. Do not turn it into quotation follow-up, payment reminder, or order confirmation unless clearly stated.',
      'Follow-up on quotation': 'Focus on the quotation only if quotation was clearly mentioned in the user situation.',
      'Payment reminder': 'Keep it polite and not aggressive. Focus only on payment or invoice status.',
      'Lead time / delivery follow-up': 'Focus only on delivery timing, lead time, or schedule. Do not turn it into quotation or order confirmation unless clearly stated.',
      'Send proposal': 'Write as a proposal-sharing email only if supported by the situation.',
      'Negotiation': 'Keep the wording tactful and commercial.',
      'Apology for delay': 'Acknowledge the delay and be responsible without adding unrelated assumptions.',
      'Meeting request': 'Keep the request clear and simple.',
      'Request quotation': 'Ask for quotation details clearly.',
      'Price negotiation': 'Negotiate price professionally and practically.',
      'Delivery follow-up': 'Follow up on delivery or shipment only.',
      'Delay complaint': 'Be firm and factual regarding the delay.',
      'Order confirmation': 'Confirm the order only if the situation clearly refers to an order.',
      'Status update': 'Keep it concise and informative.',
      'Explain delay': 'Explain the reason clearly without over-explaining.',
      'Request support': 'Ask for help clearly and politely.',
      'Task follow-up': 'Follow up on the internal task in a neutral way.',
      'Project update': 'Provide a practical project update.'
    };

    const scenarioGuidance =
      scenarioGuidanceMap[finalScenario] ||
      'Follow the situation exactly as written. Do not add extra business steps.';

    const lengthRule =
      length === 'Short'
        ? 'About 60 to 100 words.'
        : length === 'Medium'
        ? 'About 100 to 150 words.'
        : 'About 150 to 220 words.';

    const prompt = `
You are MailMuse, an expert business communication specialist and work email assistant.

Write one polished, natural, practical work email based on the details below.

Core instructions:
- The user may write in any input language.
- Understand the situation regardless of input language.
- Detect the user's requested output language naturally from the typed situation.
- The requested output language may be any language.
- If the user explicitly requests an output language, write the final email only in that language.
- If the user does not explicitly request an output language, default to the same language the user mainly used.
- Use the typed situation as the main source of truth.
- The selected scenario is only a guide, not a hard rule.
- If the selected scenario conflicts with the typed situation, follow the typed situation.
- Do NOT introduce business details that were not provided by the user.
- Do NOT assume quotation, invoice, order, contract, production, payment deadline, meeting, call, revised scope, specification change, quantity change, or timeline update unless the situation clearly supports it.
- If the situation is generic, keep the email generic.
- Avoid robotic or overly generic AI phrases.
- Include a short relevant subject line at the top.
- Structure the email properly: greeting, message body, closing.
- Make the email realistic and ready to send immediately.
- Do not add explanations before or after the email.

Tone rules:
- Professional: neutral and business-like
- Polite: respectful and considerate
- Friendly: warm but still professional
- Firm: clear and direct but respectful

Length rule:
- ${lengthRule}

Scenario handling:
- Audience: ${audience}
- Selected scenario in UI: ${selectedScenario}
- Detected scenario from situation: ${detectedScenario}
- Final scenario to follow: ${finalScenario}
- Output language request detected from situation: ${requestedOutputLanguage}

Specific scenario guidance:
${scenarioGuidance}

User details:
- Situation: ${situation}
${recipientName ? `- Recipient name to use if natural: ${recipientName}` : '- Recipient name is not provided.'}
${senderName ? `- Sender name to use in sign-off: ${senderName}` : '- If no sender name is provided, use a neutral professional sign-off without a name.'}

Write the full email now.
Only output the email.
    `.trim();

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: prompt
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'OpenAI request failed'
      });
    }

    const email =
      data.output_text ||
      (data.output || [])
        .flatMap(item => item.content || [])
        .filter(content => content.type === 'output_text' && content.text)
        .map(content => content.text)
        .join('\n')
        .trim();

    if (!email) {
      return res.status(500).json({ error: 'No email returned from model' });
    }

    return res.status(200).json({ email });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}
