interface Props {
  description: string;
}

export default function ProjectDescription({ description }: Props) {
  if (!description) return null;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
      <p className="text-gray-700 whitespace-pre-wrap">{description}</p>
    </div>
  );
}
