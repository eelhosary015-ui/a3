export class CostService {
  constructor() {}

  async getCosts(): Promise<any[]> {
    return [];
  }

  async createCost(dto: any): Promise<any> {
    return { id: 1, ...dto };
  }
}
