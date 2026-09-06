export class CostRepository {
  constructor() {}

  async getAll(): Promise<any[]> {
    return [];
  }

  async create(cost: any): Promise<any> {
    return { id: 1, ...cost };
  }
}
