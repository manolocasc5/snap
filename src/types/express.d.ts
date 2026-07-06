declare namespace Express {
  interface Request {
    user?: {
      readonly id: number;
      readonly email: string;
    };
  }
}