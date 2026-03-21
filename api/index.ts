import { Request, Response } from 'express';

export default function handler(req: Request, res: Response) {
  res.status(200).json({ 
    status: 'ok', 
    message: 'This is a serverless wrapper. For full functionality, deploy to a VPS with WebSocket support.' 
  });
}