import React from 'react';
import { Button, Card } from 'react-bootstrap';

interface DebugProps {
  data: any;
  title?: string;
  expanded?: boolean;
}

const Debug: React.FC<DebugProps> = ({ data, title = 'Debug Info', expanded = false }) => {
  const [isExpanded, setIsExpanded] = React.useState(expanded);

  return (
    <Card className="mt-3 mb-3">
      <Card.Header className="bg-warning d-flex justify-content-between align-items-center">
        <span>{title}</span>
        <Button 
          size="sm" 
          variant="outline-dark" 
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Hide' : 'Show'}
        </Button>
      </Card.Header>
      {isExpanded && (
        <Card.Body>
          <pre className="bg-light p-2 rounded" style={{ maxHeight: '300px', overflow: 'auto' }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </Card.Body>
      )}
    </Card>
  );
};

export default Debug;