import { BigNumber } from 'ethers'

declare global {
  namespace jest {
    interface Matchers<R> {
      toEq(a: BigNumber): R;
      toApproxEq(a: BigNumber, digits: number): R;
    }
  }
}
