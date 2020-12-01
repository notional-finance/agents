import { BigNumber } from "ethers"

export default {
  toEq(received: BigNumber, a: BigNumber) {
    return {
      message: () => 
        `expected ${received.toString()} to equal ${a.toString()}`,
      pass: received.eq(a)
    }
  },
  toApproxEq(received: BigNumber, a: BigNumber, digits: number) {
    const receivedApprox = received.div(BigNumber.from(10).pow(digits))
    const approx = a.div(BigNumber.from(10).pow(digits))

    return {
      message: () => 
        `expected ${receivedApprox.toString()} to approximately equal ${approx.toString()}`,
      pass: receivedApprox.eq(approx)

    }
  }
}