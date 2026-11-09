// Two versions of one form, shaped like GET /forms/:id/versions/:version: every document is a string, the layout
// as Prettier-formatted JSX and the rest as pretty-printed JSON.

const layoutV1 = `<Form color="#000235">
  <View type="web">
    <Section id="header">
      <Text id="title" columns={8}>
        <h1 style={{ textAlign: "right" }}>
          <b>90-Day Evaluation</b>
        </h1>
      </Text>
    </Section>
    <Section wide={false}>
      <Input id="employeeName" label="Employee Name" columns={6} />
      <Input
        id="employeeEmail"
        label="Employee Email"
        type="email"
        columns={6}
      />
    </Section>
    <Section marginTop={30} wide={false} border>
      <Radio
        id="rating"
        label="Rating"
        horizontal
        options={[
          { 1: "Unsatisfactory" },
          { 2: "Basic" },
          { 3: "Proficient" },
        ]}
      />
      <Textarea id="comment" label="Comment" rows={3} />
    </Section>
  </View>
  <Actions />
  <Section id="hiddenFields" display={{ action: "alwaysHide" }}>
    <Computed
      id="average"
      label="Average"
      formula="(Math.round(
        (parseInt(rating)) / 1)) || 'incomplete'"
    />
  </Section>
</Form>`;

// Same layout with: a retitled heading, a relabelled field, a fourth rating option, the comment box moved into the
// hidden section, a new signature field, and the middle section's margin changed. The header is merely re-wrapped.
const layoutV2 = `<Form color="#000235">
  <View type="web">
    <Section id="header">
      <Text id="title" columns={8}>
        <h1 style={{ textAlign: "right" }}><b>Annual Evaluation</b></h1>
      </Text>
    </Section>
    <Section wide={false}>
      <Input id="employeeName" label="Staff Name" columns={6} />
      <Input id="employeeEmail" label="Employee Email" type="email" columns={6} />
    </Section>
    <Section marginTop={10} wide={false} border>
      <Radio
        id="rating"
        label="Rating"
        horizontal
        options={[{ 1: "Unsatisfactory" }, { 2: "Basic" }, { 3: "Proficient" }, { 4: "Distinguished" }]}
      />
      <Signature id="signature" label="Evaluator's Signature" columns={8} />
    </Section>
  </View>
  <Actions />
  <Section id="hiddenFields" display={{ action: "alwaysHide" }}>
    <Computed
      id="average"
      label="Average"
      formula="(Math.round(
        (parseInt(rating)) / 1)) || 'incomplete'"
    />
    <Textarea id="comment" label="Comment" rows={3} />
  </Section>
</Form>`;

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

const formVersionV1 = {
  version: 'v-1',
  layout: layoutV1,
  workflow: pretty({
    steps: {
      start: { onSubmit: [{ target: 'employee' }], position: [160, 80] },
      employee: { status: 'pending', label: 'Employee Step', onSubmit: [{ target: 'completed' }] },
      completed: { status: 'completed' },
    },
  }),
  steps: pretty({
    start: { permissions: { employeeName: 'editable', employeeEmail: 'editable', comment: 'editable' } },
    employee: { permissions: { comment: 'readonly' }, actions: {} },
  }),
  attributes: '{}',
  datasets: '{"local":{},"global":{}}',
  notifications: '{}',
  integrations: '{}',
  translations: '{}',
  tagExpressions: '{}',
};

const formVersionV2 = {
  ...formVersionV1,
  version: 'v-2',
  layout: layoutV2,
  // Key order shuffled, a step inserted before "employee" in start.onSubmit, and a label changed.
  workflow: pretty({
    steps: {
      completed: { status: 'completed' },
      employee: { onSubmit: [{ target: 'completed' }], label: 'Staff Step', status: 'pending' },
      start: { position: [160, 80], onSubmit: [{ target: 'review' }, { target: 'employee' }] },
      review: { status: 'pending' },
    },
  }),
  steps: pretty({
    employee: { actions: {}, permissions: { comment: 'readonly', signature: 'editable' } },
    start: { permissions: { employeeEmail: 'editable', employeeName: 'readonly' } },
  }),
  // Compact rather than pretty-printed, and one document omitted entirely: neither is a change.
  datasets: '{"global":{},"local":{}}',
  translations: undefined,
};

export { formVersionV1, formVersionV2, layoutV1, layoutV2 };
